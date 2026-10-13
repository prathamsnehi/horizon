import { GenerationContext } from "./types";
export const ATTEMPT_TIMEOUT_MS = 20_000;
export const GENERATION_TIMEOUT_MS = 60_000;
export class GenerationUnavailable extends Error {
  constructor(public readonly reason: string, public readonly retryAtMs = Date.now() + 30_000) {
    super("Generation is temporarily busy. Please try again shortly — your daily quest wasn't used.");
    this.name = "GenerationUnavailable";
  }
}
export function generationContext(priority: GenerationContext["priority"] = "foreground"): GenerationContext {
  return { priority, deadlineMs: Date.now() + GENERATION_TIMEOUT_MS };
}
export function generationSignal(context: GenerationContext, maximumMs = ATTEMPT_TIMEOUT_MS): AbortSignal {
  const remaining = Math.min(maximumMs, context.deadlineMs - Date.now());
  if (remaining <= 0) throw new GenerationUnavailable("generation_deadline");
  return AbortSignal.timeout(remaining);
}
