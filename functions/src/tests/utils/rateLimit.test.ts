import {
  evaluateReservation,
  RATE_WINDOW_MS,
  PENDING_TTL_MS,
} from "../../utils/rateLimit";

describe("evaluateReservation (two-phase 24h + pending TTL)", () => {
  const now = 1_700_000_000_000;

  it("allows when there's no last stamp and no pending", () => {
    expect(evaluateReservation(null, null, now)).toEqual({ allowed: true });
  });

  it("denies inside the durable 24h window (retry = last + 24h)", () => {
    const last = now - (RATE_WINDOW_MS - 1000); // ~1s short of a day
    const r = evaluateReservation(last, null, now);
    expect(r.allowed).toBe(false);
    expect(r.retryAtMs).toBe(last + RATE_WINDOW_MS);
  });

  it("the 24h window takes precedence over a pending stamp", () => {
    const last = now - (RATE_WINDOW_MS - 1000);
    const pending = now - 1000;
    const r = evaluateReservation(last, pending, now);
    expect(r.retryAtMs).toBe(last + RATE_WINDOW_MS); // not pending + TTL
  });

  it("denies on an unexpired pending reservation (retry = pending + TTL)", () => {
    const pending = now - (PENDING_TTL_MS - 1000); // in flight / just failed
    const r = evaluateReservation(null, pending, now);
    expect(r.allowed).toBe(false);
    expect(r.retryAtMs).toBe(pending + PENDING_TTL_MS);
  });

  it("allows once the pending stamp has expired (killed run self-heals)", () => {
    const pending = now - (PENDING_TTL_MS + 1); // older than the TTL
    expect(evaluateReservation(null, pending, now)).toEqual({ allowed: true });
  });

  it("allows once the 24h window has fully elapsed", () => {
    const last = now - (RATE_WINDOW_MS + 60_000);
    expect(evaluateReservation(last, null, now)).toEqual({ allowed: true });
  });

  it("allows exactly at the window boundaries", () => {
    expect(evaluateReservation(now - RATE_WINDOW_MS, null, now)).toEqual({
      allowed: true,
    });
    expect(evaluateReservation(null, now - PENDING_TTL_MS, now)).toEqual({
      allowed: true,
    });
  });

  it("PENDING_TTL_MS is ≥ the 75s function timeout", () => {
    expect(PENDING_TTL_MS).toBeGreaterThanOrEqual(75_000);
  });
});
