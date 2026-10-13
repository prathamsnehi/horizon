jest.mock("firebase-functions/v2", () => ({ https: {
  onCall: jest.fn((_options, handler) => handler),
  HttpsError: class extends Error { constructor(public code: string, message: string, public details?: any) { super(message); } },
} }));
jest.mock("firebase-admin/functions", () => ({ getFunctions: () => ({ taskQueue: () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }) }) }));
jest.mock("../../services/questService", () => ({ generateBatch: jest.fn(), generateDescribed: jest.fn(), attachQuestPhotos: jest.fn(async quests => quests) }));
jest.mock("../../integrations/firestore", () => ({ getPregenCache: jest.fn(), registerPregenJob: jest.fn(), reserveRateLimitSlot: jest.fn(), commitRateLimitSlot: jest.fn(), releaseRateLimitSlot: jest.fn() }));
jest.mock("../../observability/tracer", () => ({ runTrace: async (_init: any, fn: any) => fn(), span: async (_name: any, fn: any) => fn(), recordSpan: jest.fn(), setTraceField: jest.fn() }));
import { generateCuratedQuests, generateUserDescribedQuest } from "../../controllers/quests";
import { generateBatch } from "../../services/questService";
import { getPregenCache, reserveRateLimitSlot, commitRateLimitSlot, releaseRateLimitSlot, registerPregenJob } from "../../integrations/firestore";
import { GenerationUnavailable } from "../../llm/execution";
import { hashProfile } from "../../utils/hash";
const profile = { interests: ["coffee"], comfortZoneEdges: ["Meeting people"], vibe: ["quiet"], budget: ["free"], transportation: ["walking" as const], locationPreferences: ["nearby"], experimentationLevel: 2, additionalContext: null, city: "Seattle" };
const quests = [{ title: "Cafe", questDescription: "D", difficulty: "easy", estimatedActivityMinutes: 20, categories: [] }];
const call = (fn: any, data: any) => fn({ auth: { uid: "u" }, data });
beforeEach(() => {
  jest.clearAllMocks();
  (reserveRateLimitSlot as jest.Mock).mockResolvedValue({ allowed: true, reservationId: "owned" });
  (getPregenCache as jest.Mock).mockResolvedValue(null);
  (generateBatch as jest.Mock).mockResolvedValue(quests);
  (commitRateLimitSlot as jest.Mock).mockResolvedValue(undefined);
  (registerPregenJob as jest.Mock).mockResolvedValue(undefined);
});
it("cached delivery bypasses provider admission and enqueues only after commit", async () => {
  const cache = { nextBatch: quests, nextBatchHash: hashProfile(profile), nextBatchCreatedAt: Date.now(), batchId: "cached" };
  (getPregenCache as jest.Mock).mockResolvedValue(cache);
  const order: string[] = [];
  (commitRateLimitSlot as jest.Mock).mockImplementation(async () => order.push("commit"));
  (registerPregenJob as jest.Mock).mockImplementation(async () => order.push("enqueue"));
  expect(await call(generateCuratedQuests, { profile })).toEqual({ quests });
  expect(generateBatch).not.toHaveBeenCalled(); expect(order).toEqual(["commit", "enqueue"]);
  expect(commitRateLimitSlot).toHaveBeenCalledWith("u", "curated", "owned", cache);
});
it("rejects cached quests conflicting with the current exclusions", async () => {
  (getPregenCache as jest.Mock).mockResolvedValue({ nextBatch: quests, nextBatchHash: hashProfile(profile), nextBatchCreatedAt: Date.now() });
  await call(generateCuratedQuests, { profile, excludeTitles: ["cafe"] });
  expect(generateBatch).toHaveBeenCalledWith(profile, 3, ["cafe"], expect.objectContaining({ priority: "foreground" }));
});
it("provider busy releases ownership and cannot consume the daily allowance", async () => {
  (generateBatch as jest.Mock).mockRejectedValueOnce(new GenerationUnavailable("provider_capacity"));
  await expect(call(generateCuratedQuests, { profile })).rejects.toMatchObject({ code: "unavailable", details: { reason: "provider_capacity" } });
  expect(commitRateLimitSlot).not.toHaveBeenCalled(); expect(releaseRateLimitSlot).toHaveBeenCalledWith("u", "curated", "owned");
});
it.each([generateCuratedQuests, generateUserDescribedQuest])("pending work is temporary, whereas a spent allowance is resource-exhausted", async fn => {
  (reserveRateLimitSlot as jest.Mock).mockResolvedValueOnce({ allowed: false, reason: "generation_in_progress", retryAt: "2026-10-12T12:01:00Z" });
  await expect(call(fn, { profile, prompt: "Read at home" })).rejects.toMatchObject({ code: "unavailable" });
  (reserveRateLimitSlot as jest.Mock).mockResolvedValueOnce({ allowed: false, reason: "daily_allowance" });
  await expect(call(fn, { profile, prompt: "Read at home" })).rejects.toMatchObject({ code: "resource-exhausted" });
});
it("queue failure never rolls back a committed generation", async () => {
  (registerPregenJob as jest.Mock).mockRejectedValueOnce(new Error("queue storage unavailable"));
  const log = jest.spyOn(console, "warn").mockImplementation(() => {});
  expect(await call(generateCuratedQuests, { profile })).toEqual({ quests });
  expect(commitRateLimitSlot).toHaveBeenCalledTimes(1); expect(releaseRateLimitSlot).not.toHaveBeenCalled(); log.mockRestore();
});

it("a slow pre-generation enqueue cannot hold an already committed response", async () => {
  jest.useFakeTimers();
  const log = jest.spyOn(console, "warn").mockImplementation(() => {});
  (registerPregenJob as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
  const response = call(generateCuratedQuests, { profile });
  await jest.advanceTimersByTimeAsync(3001);
  expect(await response).toEqual({ quests });
  expect(commitRateLimitSlot).toHaveBeenCalledTimes(1);
  log.mockRestore(); jest.useRealTimers();
});
