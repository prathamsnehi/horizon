import { generateText, Output } from "ai";
import { z } from "zod";
import { setTimeout as delay } from "node:timers/promises";
import { GenerationContext, GenerationStage, ProviderId, RoutingAttempt, RoutingResult, TokenUsage } from "./types";
import { COMPLETION_TOKEN_CAP, GROQ_MODEL, LUNA_MODEL, providerOptions, resolveModel } from "./client";
import { reserveProvider, settleProvider } from "../integrations/gatewayStore";
import { recordSpan } from "../observability/tracer";
import { retryAfterMs } from "./admission";
import { withinTimeout } from "../utils/timeout";

import { generationContext, generationSignal, GenerationUnavailable } from "./execution";
export { generationContext, generationSignal, GenerationUnavailable } from "./execution";

export function classifyProviderError(error: unknown): { transient: boolean; status?: number; code: string; headers?: Record<string, string> } {
  const e = error as { statusCode?: number; status?: number; name?: string; responseHeaders?: Record<string, string>; cause?: { name?: string; code?: string }; message?: string };
  const status = e?.statusCode ?? e?.status;
  const name = e?.name ?? "Error";
  const invalidOutput = /NoObjectGenerated|TypeValidation|JSONParse|ValidationError/.test(name);
  const network = /Abort|Timeout/.test(name) || /Abort|Timeout/.test(e?.cause?.name ?? "") ||
    /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT)$/.test(e?.cause?.code ?? "") ||
    (name === "TypeError" && e?.message === "fetch failed") || (name === "AI_APICallError" && status == null);
  return {
    transient: !invalidOutput && (status === 429 || (status != null && status >= 500 && status < 600) || network),
    status,
    code: status != null ? `provider_http_${status}` : invalidOutput ? "invalid_output" : network ? "provider_network_or_timeout" : "provider_configuration_or_output_error",
    headers: e?.responseHeaders,
  };
}

function tokenUsage(value: TokenUsage | undefined): TokenUsage | undefined {
  if (!value) return undefined;
  const usage: TokenUsage = {};
  for (const key of ["inputTokens", "outputTokens", "totalTokens"] as const) {
    const count = value[key];
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) usage[key] = count;
  }
  return Object.keys(usage).length ? usage : undefined;
}
function estimatedCost(provider: ProviderId, usage: TokenUsage | undefined): number | undefined {
  if (usage?.inputTokens == null || usage.outputTokens == null) return undefined;
  const rates = provider === "tokenrouter" ? [0.10, 0.50] : [0.15, 0.60];
  return (usage.inputTokens * rates[0] + usage.outputTokens * rates[1]) / 1_000_000;
}

export interface RoutingOptions<T> {
  schema: z.ZodType<T>;
  prompt: string;
  temperature?: number;
  context?: GenerationContext;
}

/** Fixed Luna -> foreground Groq path. No model ranking or hidden SDK retries. */
export async function generateStructured<T>(stage: GenerationStage, options: RoutingOptions<T>): Promise<RoutingResult<T>> {
  const context = options.context ?? generationContext();
  const started = Date.now();
  const attemptLog: RoutingAttempt[] = [];
  let capacityWaitMs = 0;
  let fallbackReason: string | undefined;
  let earliestRetryAt: number | undefined;
  let lastBusy = new GenerationUnavailable("provider_capacity");
  // Estimates guide observed Groq token headroom; upstream limits remain authoritative.
  const tokenEstimate = Math.ceil(Buffer.byteLength(options.prompt + JSON.stringify(z.toJSONSchema(options.schema))) / 3) + COMPLETION_TOKEN_CAP;
  const providers: ProviderId[] = context.priority === "foreground" ? ["tokenrouter", "groq"] : ["tokenrouter"];
  try {
    for (const provider of providers) {
      if (Date.now() >= context.deadlineMs) throw new GenerationUnavailable("generation_deadline");
      const waitStart = Date.now();
      const waitUntil = Math.min(context.deadlineMs, waitStart + (provider === "tokenrouter" && context.priority === "foreground" ? 2000 : 0));
      let admission;
      do {
        try {
          admission = await withinTimeout(reserveProvider(provider, context.priority, tokenEstimate), Math.min(2000, context.deadlineMs - Date.now(), waitUntil > waitStart ? waitUntil - Date.now() : 2000));
        } catch { throw new GenerationUnavailable("capacity_storage_unavailable"); }
        if (admission.allowed || Date.now() >= waitUntil) break;
        await delay(Math.max(1, Math.min(250, waitUntil - Date.now(), (admission.retryAtMs ?? Date.now() + 250) - Date.now())));
      } while (Date.now() < waitUntil);
      capacityWaitMs += Date.now() - waitStart;
      if (!admission?.allowed) {
        lastBusy = new GenerationUnavailable("provider_capacity", admission?.retryAtMs);
        earliestRetryAt = Math.min(earliestRetryAt ?? Infinity, lastBusy.retryAtMs);
        fallbackReason ??= "luna_capacity";
        continue;
      }
      const lease = admission.lease!;
      const callStart = Date.now();
      const model = provider === "tokenrouter" ? LUNA_MODEL : GROQ_MODEL;
      let usage: TokenUsage | undefined;
      let headers: Record<string, string> | undefined;
      let completion: Parameters<typeof settleProvider>[2] = { ok: false };
      try {
        const result = await generateText({
          model: resolveModel(provider), output: Output.object({ schema: options.schema }),
          prompt: options.prompt, maxOutputTokens: COMPLETION_TOKEN_CAP,
          maxRetries: 0, abortSignal: generationSignal(context), providerOptions: providerOptions(provider),
          ...(options.temperature != null ? { temperature: options.temperature } : {}),
        });
        usage = tokenUsage(result.usage);
        headers = result.response.headers;
        const object = result.output;
        completion = { ok: true, headers };
        attemptLog.push({ provider, model, ok: true, latencyMs: Date.now() - callStart, usage,
          estimatedCostUsd: estimatedCost(provider, usage), unknownUsage: usage?.inputTokens == null || usage.outputTokens == null });
        return { object, providerUsed: provider, modelUsed: model, attempts: attemptLog.length,
          latencyMs: Date.now() - started, attemptLog, capacityWaitMs, fallbackReason };
      } catch (error) {
        if (error instanceof GenerationUnavailable) throw error;
        const failure = classifyProviderError(error);
        usage ??= tokenUsage((error as { usage?: TokenUsage })?.usage);
        completion = { ok: false, transient: failure.transient, status: failure.status, headers: failure.headers ?? headers };
        attemptLog.push({ provider, model, ok: false, latencyMs: Date.now() - callStart, error: failure.code,
          usage, estimatedCostUsd: estimatedCost(provider, usage), unknownUsage: usage?.inputTokens == null || usage.outputTokens == null });
        // Never propagate provider bodies, prompts, credentials, or SDK diagnostics.
        if (!failure.transient) throw new Error(failure.code);
        fallbackReason ??= failure.code;
        lastBusy = new GenerationUnavailable(failure.code, retryAfterMs(failure.headers, Date.now(), failure.status === 429 ? 60_000 : 30_000));
        earliestRetryAt = Math.min(earliestRetryAt ?? Infinity, lastBusy.retryAtMs);
      } finally {
        try { await withinTimeout(settleProvider(provider, lease.id, completion), 2000); }
        catch { console.warn("[ai.gateway] settlement unavailable; lease will expire"); }
      }
    }
    throw new GenerationUnavailable(lastBusy.reason, earliestRetryAt ?? lastBusy.retryAtMs);
  } catch (error) {
    recordSpan(stage, { startMs: started, latencyMs: Date.now() - started,
      meta: { ok: false, attemptLog, attempts: attemptLog.length, capacityWaitMs, fallbackReason,
        error: error instanceof GenerationUnavailable ? error.reason : (error as Error).message } });
    throw error;
  }
}
