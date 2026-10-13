export type ProviderId = "tokenrouter" | "groq";
export type GenerationStage = "scout" | "writer" | "generic" | "planner";
export interface GenerationContext {
  priority: "foreground" | "background";
  deadlineMs: number;
}
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
export interface RoutingAttempt {
  provider: ProviderId;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  usage?: TokenUsage;
  estimatedCostUsd?: number;
  unknownUsage?: boolean;
}
export interface RoutingResult<T> {
  object: T;
  providerUsed: ProviderId;
  modelUsed: string;
  attempts: number;
  latencyMs: number;
  attemptLog: RoutingAttempt[];
  capacityWaitMs: number;
  fallbackReason?: string;
}
