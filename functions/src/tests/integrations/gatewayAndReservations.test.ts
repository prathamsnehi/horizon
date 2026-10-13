import { memoryFirestore } from "../helpers/memoryFirestore";
const database = memoryFirestore();
const exemption = jest.fn(() => "");
jest.mock("../../config", () => ({ BATCH_TTL_MS: 60 * 86_400_000, rateLimitExemptUids: { value: () => exemption() } }));
jest.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: () => ({}) }));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => database,
  Timestamp: { fromMillis: (ms: number) => database.timestamp(ms), now: () => database.timestamp(Date.now()) },
  FieldValue: { delete: () => database.deleted },
}));
import { reserveProvider, settleProvider } from "../../integrations/gatewayStore";
import { reserveRateLimitSlot, commitRateLimitSlot, releaseRateLimitSlot, registerPregenJob, claimPregenJob, finishPregenJob } from "../../integrations/firestore";
import { PregenTaskPayload, QuestItem } from "../../types";
const batch: QuestItem[] = [{ title: "Q", questDescription: "D", difficulty: "easy", estimatedActivityMinutes: 10, categories: [] }];
const payload: PregenTaskPayload = { uid: "u", profile: {} as any, profileHash: "hash", jobId: "job1", expiresAt: Date.now() + 3_600_000, excludeTitles: [] };
beforeEach(() => { database.documents.clear(); database.runTransaction.mockClear(); exemption.mockReturnValue(""); });
it("atomically admits at most three calls from concurrent instances", async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => reserveProvider("tokenrouter", "foreground", 1000)));
  expect(results.filter(r => r.allowed)).toHaveLength(3);
  expect(database.documents.get("ai_gateway_state/tokenrouter").starts).toHaveLength(3);
  await settleProvider("tokenrouter", results.find(r => r.allowed)!.lease!.id, { ok: true });
  expect((await reserveProvider("tokenrouter", "foreground", 1000)).allowed).toBe(true);
});
it("storage failure denies admission", async () => {
  database.runTransaction.mockRejectedValueOnce(new Error("offline"));
  await expect(reserveProvider("tokenrouter", "foreground", 1000)).rejects.toThrow("offline");
});
it("old requests cannot release or commit newer user reservations", async () => {
  const first = await reserveRateLimitSlot("u", "curated");
  const pending = database.documents.get("user_rate_limits/u");
  pending.pendingCuratedAt = database.timestamp(Date.now() - 90_001);
  const second = await reserveRateLimitSlot("u", "curated");
  await releaseRateLimitSlot("u", "curated", first.reservationId);
  expect(database.documents.get("user_rate_limits/u").pendingCuratedAtId).toBe(second.reservationId);
  await expect(commitRateLimitSlot("u", "curated", first.reservationId)).rejects.toThrow("reservation_expired");
  await commitRateLimitSlot("u", "curated", second.reservationId);
  expect((await reserveRateLimitSlot("u", "curated")).reason).toBe("daily_allowance");
});
it("pending contention differs from the durable allowance; failures release immediately", async () => {
  const first = await reserveRateLimitSlot("u", "described");
  expect((await reserveRateLimitSlot("u", "described")).reason).toBe("generation_in_progress");
  await releaseRateLimitSlot("u", "described", first.reservationId);
  expect((await reserveRateLimitSlot("u", "described")).allowed).toBe(true);
});
it("commits delivery and consumes exactly the batch read, preserving a newer cache", async () => {
  const reservation = await reserveRateLimitSlot("u", "curated");
  database.documents.set("pregen_cache/u", { batchId: "new", nextBatchCreatedAt: 2, nextBatch: batch });
  await commitRateLimitSlot("u", "curated", reservation.reservationId, { batchId: "old", nextBatchCreatedAt: 1 });
  expect(database.documents.get("pregen_cache/u").nextBatch).toEqual(batch);
  const another = await reserveRateLimitSlot("v", "curated");
  database.documents.set("pregen_cache/v", { batchId: "same", nextBatchCreatedAt: 2, nextBatch: batch });
  await commitRateLimitSlot("v", "curated", another.reservationId, { batchId: "same", nextBatchCreatedAt: 2 });
  expect(database.documents.get("pregen_cache/v").nextBatch).toBeUndefined();
});
it("exempt users still require global admission", async () => {
  exemption.mockReturnValue("u");
  expect((await reserveRateLimitSlot("u", "curated")).allowed).toBe(true);
  for (let i = 0; i < 3; i++) await reserveProvider("tokenrouter", "foreground", 1000);
  expect((await reserveProvider("tokenrouter", "foreground", 1000)).allowed).toBe(false);
});
it("duplicate tasks cannot publish twice and older jobs cannot overwrite new cache", async () => {
  await registerPregenJob(payload);
  const first = await claimPregenJob(payload);
  expect(first.status).toBe("claimed");
  expect((await claimPregenJob(payload)).status).toBe("busy");
  if (first.status !== "claimed") throw new Error();
  const newer = { ...payload, jobId: "job2" };
  await registerPregenJob(newer);
  expect(await finishPregenJob(payload, first.leaseId, "ready", batch)).toBe(false);
  const current = await claimPregenJob(newer);
  if (current.status !== "claimed") throw new Error();
  expect(await finishPregenJob(newer, current.leaseId, "ready", batch)).toBe(true);
  expect((await claimPregenJob(newer)).status).toBe("skip");
  expect(database.documents.get("pregen_cache/u").batchId).toBe("job2");
});
it("an expired worker lease cannot replace a newer worker's results", async () => {
  await registerPregenJob(payload);
  const old = await claimPregenJob(payload);
  const cache = database.documents.get("pregen_cache/u"); cache.job.leaseUntil = Date.now() - 1;
  const fresh = await claimPregenJob(payload);
  if (old.status !== "claimed" || fresh.status !== "claimed") throw new Error();
  expect(await finishPregenJob(payload, old.leaseId, "ready", batch)).toBe(false);
  expect(await finishPregenJob(payload, fresh.leaseId, "ready", batch)).toBe(true);
});

it("late registration from an older delivery cannot replace the newest job", async () => {
  const newest = { ...payload, jobId: "newest", expiresAt: payload.expiresAt + 1000 };
  await registerPregenJob(newest); await registerPregenJob(payload);
  expect(database.documents.get("pregen_cache/u").job.id).toBe("newest");
});
