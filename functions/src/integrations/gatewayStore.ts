import { randomUUID } from "node:crypto";
import { getDb } from "./firestore";
import { admit, AdmissionResult, ProviderState, settle } from "../llm/admission";
import { GenerationContext, ProviderId } from "../llm/types";

/** Storage failures propagate: provider admission always fails closed. */
export async function reserveProvider(provider: ProviderId, priority: GenerationContext["priority"], tokenEstimate: number): Promise<AdmissionResult> {
  const ref = getDb().doc(`ai_gateway_state/${provider}`);
  const id = randomUUID();
  return getDb().runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const result = admit(provider, (snapshot.data() ?? {}) as ProviderState, priority, Date.now(), id, tokenEstimate);
    if (result.allowed) tx.set(ref, result.state);
    return result;
  });
}
export async function settleProvider(provider: ProviderId, leaseId: string, result: Parameters<typeof settle>[3]): Promise<void> {
  const ref = getDb().doc(`ai_gateway_state/${provider}`);
  await getDb().runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    tx.set(ref, settle((snapshot.data() ?? {}) as ProviderState, leaseId, Date.now(), result));
  });
}
