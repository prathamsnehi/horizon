jest.mock("firebase-functions/v2/tasks", () => ({ onTaskDispatched: jest.fn((_options, fn) => fn) }));
jest.mock("../../services/questService", () => ({ generateBatch: jest.fn() }));
jest.mock("../../integrations/firestore", () => ({ claimPregenJob: jest.fn(), finishPregenJob: jest.fn() }));
jest.mock("../../observability/tracer", () => ({ runTrace: async (_init: any, fn: any) => fn(), setTraceField: jest.fn() }));
import { pregenerateCuratedBatch } from "../../controllers/tasks";
import { claimPregenJob, finishPregenJob } from "../../integrations/firestore";
import { generateBatch } from "../../services/questService";
import { GenerationUnavailable } from "../../llm/execution";
import { hashProfile } from "../../utils/hash";
const profile = { interests: ["coffee"], comfortZoneEdges: ["Meeting people"], vibe: ["quiet"], budget: ["free"], transportation: ["walking" as const], locationPreferences: ["nearby"], experimentationLevel: 2, additionalContext: null, city: "Seattle" };
const payload = () => ({ uid: "u", jobId: "job", profileHash: hashProfile(profile), profile, expiresAt: Date.now() + 3_600_000, excludeTitles: [] });
const call = (data = payload()) => (pregenerateCuratedBatch as any)({ data });
beforeEach(() => { jest.clearAllMocks(); (claimPregenJob as jest.Mock).mockResolvedValue({ status: "claimed", leaseId: "worker" }); (finishPregenJob as jest.Mock).mockResolvedValue(true); });
it("propagates capacity failures so Cloud Tasks retries", async () => {
  (generateBatch as jest.Mock).mockRejectedValueOnce(new GenerationUnavailable("provider_capacity"));
  await expect(call()).rejects.toBeInstanceOf(GenerationUnavailable);
  expect(finishPregenJob).toHaveBeenCalledWith(expect.anything(), "worker", "pending");
});
it("stops permanent failures without a fallback", async () => {
  (generateBatch as jest.Mock).mockRejectedValueOnce(new Error("invalid_output"));
  await expect(call()).resolves.toBeUndefined();
  expect(finishPregenJob).toHaveBeenCalledWith(expect.anything(), "worker", "failed");
});
it("does not regenerate duplicate completed jobs", async () => {
  (claimPregenJob as jest.Mock).mockResolvedValueOnce({ status: "skip" });
  await call(); expect(generateBatch).not.toHaveBeenCalled();
});
it("runs the pipeline with background priority and rejects expired jobs", async () => {
  (generateBatch as jest.Mock).mockResolvedValueOnce([]); await call();
  expect(generateBatch).toHaveBeenCalledWith(profile, 3, [], expect.objectContaining({ priority: "background" }));
  jest.clearAllMocks(); await call({ ...payload(), expiresAt: Date.now() - 1 });
  expect(claimPregenJob).not.toHaveBeenCalled();
});
