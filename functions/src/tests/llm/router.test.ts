import { z } from "zod";
jest.mock("ai", () => ({ generateText: jest.fn(), Output: { object: jest.fn() } }));
jest.mock("../../llm/client", () => ({
  resolveModel: (provider: string) => ({ provider }), providerOptions: () => ({}),
  LUNA_MODEL: "openai/gpt-6-luna", GROQ_MODEL: "openai/gpt-oss-120b",
  COMPLETION_TOKEN_CAP: 4096, ATTEMPT_TIMEOUT_MS: 20_000, GENERATION_TIMEOUT_MS: 60_000,
}));
jest.mock("../../integrations/gatewayStore", () => ({ reserveProvider: jest.fn(), settleProvider: jest.fn() }));
jest.mock("../../observability/tracer", () => ({ recordSpan: jest.fn() }));
import { generateText } from "ai";
import { generateStructured, GenerationUnavailable, generationContext } from "../../llm/router";
import { reserveProvider, settleProvider } from "../../integrations/gatewayStore";
import { recordSpan } from "../../observability/tracer";
const gen = generateText as jest.Mock, reserve = reserveProvider as jest.Mock, settle = settleProvider as jest.Mock;
const schema = z.object({ ok: z.boolean() });
const success = { output: { ok: true }, usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 }, response: { headers: {} } };
const run = (context = generationContext()) => generateStructured("writer", { schema, prompt: "p", context });
beforeEach(() => {
  jest.useRealTimers(); jest.clearAllMocks();
  reserve.mockResolvedValue({ allowed: true, lease: { id: "lease" } });
  settle.mockResolvedValue(undefined); gen.mockReset(); gen.mockResolvedValue(success);
});
it("uses Luna with bounded output, no SDK retries, usage, and a cancellation signal", async () => {
  const result = await run();
  expect(result.providerUsed).toBe("tokenrouter");
  expect(result.attemptLog[0].estimatedCostUsd).toBeCloseTo(0.00011);
  expect(gen.mock.calls[0][0]).toMatchObject({ maxOutputTokens: 4096, maxRetries: 0 });
  expect(gen.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal);
  expect(settle).toHaveBeenCalledWith("tokenrouter", "lease", expect.objectContaining({ ok: true }));
});
it.each([429, 500, 503])("switches once to Groq after HTTP %i", async status => {
  gen.mockRejectedValueOnce(Object.assign(new Error("body containing a secret"), { statusCode: status }));
  const result = await run();
  expect(result.providerUsed).toBe("groq"); expect(result.attempts).toBe(2);
  expect(JSON.stringify(result)).not.toContain("body containing a secret");
  expect(settle).toHaveBeenCalledWith("tokenrouter", "lease", expect.objectContaining({ transient: true, status }));
});
it.each([400, 401, 402, 403])("does not hide configuration/billing HTTP %i", async status => {
  gen.mockRejectedValueOnce(Object.assign(new Error("unsafe body"), { statusCode: status }));
  await expect(run()).rejects.toThrow(`provider_http_${status}`);
  expect(gen).toHaveBeenCalledTimes(1);
});
it("does not fallback for invalid output and still captures its known usage", async () => {
  gen.mockRejectedValueOnce(Object.assign(new Error("private generated content"), { name: "AI_NoObjectGeneratedError", usage: success.usage }));
  await expect(run()).rejects.toThrow("invalid_output");
  expect(gen).toHaveBeenCalledTimes(1);
  expect(recordSpan).toHaveBeenCalledWith("writer", expect.objectContaining({ meta: expect.objectContaining({ attemptLog: [expect.objectContaining({ unknownUsage: false })] }) }));
});
it("fails closed on storage failure without calling either provider", async () => {
  reserve.mockRejectedValueOnce(new Error("database private details"));
  await expect(run()).rejects.toBeInstanceOf(GenerationUnavailable);
  expect(gen).not.toHaveBeenCalled(); expect(reserve).toHaveBeenCalledTimes(1);
});
it("background work never falls back", async () => {
  gen.mockRejectedValueOnce(Object.assign(new Error(), { statusCode: 503 }));
  await expect(run(generationContext("background"))).rejects.toBeInstanceOf(GenerationUnavailable);
  expect(gen).toHaveBeenCalledTimes(1); expect(reserve).toHaveBeenCalledTimes(1);
});
it("capacity denial defers background work without sending a call", async () => {
  reserve.mockResolvedValue({ allowed: false, retryAtMs: Date.now() + 60_000 });
  await expect(run(generationContext("background"))).rejects.toBeInstanceOf(GenerationUnavailable);
  expect(gen).not.toHaveBeenCalled();
});
it("foreground capacity wait is bounded before Groq fallback", async () => {
  jest.useFakeTimers();
  reserve.mockImplementation(async provider => provider === "groq" ? { allowed: true, lease: { id: "g" } } : { allowed: false, retryAtMs: Date.now() + 60_000 });
  const pending = run();
  await jest.advanceTimersByTimeAsync(2001);
  expect((await pending).fallbackReason).toBe("luna_capacity");
  expect(gen).toHaveBeenCalledTimes(1); jest.useRealTimers();
});
it("expired generation never reserves capacity", async () => {
  await expect(run({ priority: "foreground", deadlineMs: Date.now() - 1 })).rejects.toBeInstanceOf(GenerationUnavailable);
  expect(reserve).not.toHaveBeenCalled();
});
it("timed-out requests fall back once; two transient failures return retryable busy", async () => {
  gen.mockRejectedValue(Object.assign(new Error(), { name: "TimeoutError" }));
  await expect(run()).rejects.toBeInstanceOf(GenerationUnavailable);
  expect(gen).toHaveBeenCalledTimes(2);
});

it("the shared deadline aborts an ongoing call without starting a fallback", async () => {
  gen.mockImplementationOnce(({ abortSignal }) => new Promise((_, reject) => {
    abortSignal.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "TimeoutError" })), { once: true });
  }));
  await expect(run({ priority: "foreground", deadlineMs: Date.now() + 30 })).rejects.toBeInstanceOf(GenerationUnavailable);
  expect(gen).toHaveBeenCalledTimes(1);
});
