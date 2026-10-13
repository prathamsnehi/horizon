import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGroq } from "@ai-sdk/groq";
import { tokenrouterApiKey, groqApiKey } from "../config";
import type { generateText } from "ai";
import { ProviderId } from "./types";

export const LUNA_MODEL = "openai/gpt-6-luna";
export const GROQ_MODEL = "openai/gpt-oss-120b";
export const COMPLETION_TOKEN_CAP = 4096;
export { ATTEMPT_TIMEOUT_MS, GENERATION_TIMEOUT_MS } from "./execution";

/** Shared by production and the isolated evaluation harness. Keys stay in memory. */
export function createLunaModel(apiKey: string) {
  return createOpenAICompatible({
    name: "tokenrouter",
    baseURL: "https://api.tokenrouter.com/v1",
    apiKey,
    supportsStructuredOutputs: true,
    transformRequestBody: ({ max_tokens, ...body }) => ({
      ...body,
      ...(max_tokens != null ? { max_completion_tokens: max_tokens } : {}),
      reasoning_effort: "none",
    }),
  })(LUNA_MODEL);
}

let luna: ReturnType<typeof createLunaModel> | undefined;
let groq: ReturnType<ReturnType<typeof createGroq>> | undefined;
export function resolveModel(provider: ProviderId) {
  if (provider === "tokenrouter") return luna ??= createLunaModel(tokenrouterApiKey.value());
  return groq ??= createGroq({ apiKey: groqApiKey.value() })(GROQ_MODEL);
}

export function providerOptions(provider: ProviderId): NonNullable<Parameters<typeof generateText>[0]["providerOptions"]> {
  return provider === "tokenrouter"
    ? { tokenrouter: { strictJsonSchema: true, reasoningEffort: "none" } }
    : { groq: { strictJsonSchema: true, structuredOutputs: true, reasoningEffort: "low" as const } };
}
