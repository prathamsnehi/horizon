/**
 * The exemption bypasses the whole reservation path, so the pure-logic tests in
 * utils/rateLimit.test.ts can't see it. These pin the two things that matter:
 * the default exempts nobody, and a configured uid bypasses all three phases.
 */
const mockValue = jest.fn<string, []>();

jest.mock("../../config", () => ({
  BATCH_TTL_MS: 60 * 24 * 60 * 60 * 1000,
  rateLimitExemptUids: { value: () => mockValue() },
}));

const txSet = jest.fn();
const docSet = jest.fn().mockResolvedValue(undefined);
let stored: any;
const runTransaction = jest.fn(async (fn: any) => fn({
  get: async () => ({ exists: !!stored, data: () => stored }),
  set: (_ref: any, data: any) => { stored = { ...stored, ...data }; txSet(_ref, data); },
}));

jest.mock("firebase-admin/app", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
}));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    runTransaction,
    collection: () => ({ doc: () => ({ set: docSet, get: async () => ({ exists: false }) }) }),
    doc: () => ({}),
  }),
  Timestamp: { fromMillis: (ms: number) => ({ toMillis: () => ms }), now: () => ({}) },
  FieldValue: { delete: () => "DELETE" },
}));

import {
  reserveRateLimitSlot,
  commitRateLimitSlot,
  releaseRateLimitSlot,
} from "../../integrations/firestore";

const EXEMPT = "dev-uid-1";
const NORMAL = "someone-else";

describe("rate-limit exemption", () => {
  beforeEach(() => {
    stored = undefined;
    txSet.mockClear();
    docSet.mockClear();
    runTransaction.mockClear();
  });

  describe("with no uids configured (the production default)", () => {
    beforeEach(() => mockValue.mockReturnValue(""));

    it("gates every user through the normal reservation transaction", async () => {
      const res = await reserveRateLimitSlot(NORMAL, "curated");
      expect(res.allowed).toBe(true);
      expect(runTransaction).toHaveBeenCalledTimes(1);
      expect(txSet).toHaveBeenCalledTimes(1); // pending stamp written
    });

    it("writes the durable stamp on commit", async () => {
      const reservation = await reserveRateLimitSlot(NORMAL, "curated");
      txSet.mockClear();
      await commitRateLimitSlot(NORMAL, "curated", reservation.reservationId);
      expect(txSet).toHaveBeenCalledTimes(1);
    });
  });

  describe("with a configured uid", () => {
    beforeEach(() => mockValue.mockReturnValue(EXEMPT));

    it("allows the exempt uid without a transaction or a pending stamp", async () => {
      const res = await reserveRateLimitSlot(EXEMPT, "curated");
      expect(res.allowed).toBe(true);
      expect(res.retryAt).toBeUndefined();
      expect(runTransaction).not.toHaveBeenCalled();
      expect(txSet).not.toHaveBeenCalled();
    });

    it("opens no 24h window on commit for the exempt uid", async () => {
      await commitRateLimitSlot(EXEMPT, "curated");
      expect(docSet).not.toHaveBeenCalled();
    });

    it("has nothing to release for the exempt uid", async () => {
      await releaseRateLimitSlot(EXEMPT, "curated");
      expect(docSet).not.toHaveBeenCalled();
    });

    it("still gates everyone who is not on the list", async () => {
      await reserveRateLimitSlot(NORMAL, "curated");
      expect(runTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the param cannot be read", () => {
    beforeEach(() =>
      mockValue.mockImplementation(() => {
        throw new Error("params unavailable outside an invocation");
      })
    );

    it("fails closed — nobody is exempt", async () => {
      await reserveRateLimitSlot(EXEMPT, "curated");
      expect(runTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("parsing the configured value", () => {
    it("accepts a comma-separated list with surrounding whitespace", async () => {
      mockValue.mockReturnValue(`someone, ${EXEMPT} , another`);
      await reserveRateLimitSlot(EXEMPT, "curated");
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it("treats an empty or whitespace-only value as nobody exempt", async () => {
      mockValue.mockReturnValue("  ,  ,");
      await reserveRateLimitSlot(EXEMPT, "curated");
      expect(runTransaction).toHaveBeenCalledTimes(1);
    });

    it("does not match on a partial uid", async () => {
      mockValue.mockReturnValue(EXEMPT.slice(0, 4));
      await reserveRateLimitSlot(EXEMPT, "curated");
      expect(runTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
