import { admit, ProviderState, resetDurationMs, retryAfterMs, settle } from "../../llm/admission";
const now = Date.parse("2026-10-12T12:00:00Z");
const claim = (state: ProviderState, at = now, priority: "foreground" | "background" = "foreground", id = "l") => admit("tokenrouter", state, priority, at, id, 1000);
it("allows three concurrent requests and expires abandoned leases", () => {
  let state: ProviderState = {};
  for (let i = 0; i < 3; i++) { const r = claim(state, now, "foreground", String(i)); expect(r.allowed).toBe(true); state = r.state; }
  expect(claim(state).allowed).toBe(false);
  expect(claim(state, now + 25_000).allowed).toBe(true);
});
it("enforces rolling RPM after completed calls, then permits the exact window boundary", () => {
  let state: ProviderState = {};
  for (let i = 0; i < 12; i++) { const r = claim(state, now + i); expect(r.allowed).toBe(true); state = settle(r.state, "l", now + i, { ok: true }); }
  expect(claim(state, now + 59_999).allowed).toBe(false);
  expect(claim(state, now + 60_000).allowed).toBe(true);
});
it("limits background concurrency and starts while preserving foreground access", () => {
  let r = claim({}, now, "background");
  expect(claim(r.state, now, "background").allowed).toBe(false);
  expect(claim(r.state).allowed).toBe(true);
  let state = settle(r.state, "l", now, { ok: true });
  for (let i = 1; i < 4; i++) { r = claim(state, now + i, "background"); state = settle(r.state, "l", now + i, { ok: true }); }
  expect(claim(state, now + 10, "background").allowed).toBe(false);
  expect(claim(state, now + 10).allowed).toBe(true);
});
it("honors cooldown and grants just one recovery probe", () => {
  const initial = claim({}).state;
  const state = settle(initial, "l", now, { ok: false, transient: true, status: 429, headers: { "retry-after": "3" } });
  expect(claim(state, now + 2999).allowed).toBe(false);
  const probe = claim(state, now + 3000, "foreground", "probe");
  expect(probe.lease?.probe).toBe(true);
  expect(claim(probe.state, now + 3001).allowed).toBe(false);
  const recovered = settle(probe.state, "probe", now + 3001, { ok: true });
  expect(recovered.recovering).toBe(false);
  expect(claim(recovered, now + 3002).allowed).toBe(true);
});
it("a failed recovery probe reopens the cooldown", () => {
  const probe = claim({ recovering: true });
  const state = settle(probe.state, "l", now, { ok: false, transient: true, status: 503 });
  expect(state.cooldownUntil).toBe(now + 30_000);
});
it("Groq uses daily limits and observed token reset times", () => {
  const daily: ProviderState = { day: "2026-10-12", dailyStarts: 900 };
  expect(admit("groq", daily, "foreground", now, "g", 1000).allowed).toBe(false);
  expect(admit("groq", daily, "foreground", now + 86_400_000, "g", 1000).allowed).toBe(true);
  const state = settle({}, "g", now, { ok: true, headers: { "x-ratelimit-remaining-tokens": "100", "x-ratelimit-reset-tokens": "1m2.5s" } });
  expect(admit("groq", state, "foreground", now, "g", 101).allowed).toBe(false);
  expect(admit("groq", state, "foreground", now + 62_500, "g", 101).allowed).toBe(true);
});
it("parses date Retry-After and rejects malformed token reset durations", () => {
  expect(retryAfterMs({ "retry-after": new Date(now + 3000).toUTCString() }, now, 60_000)).toBe(now + 3000);
  expect(resetDurationMs("garbage")).toBeUndefined(); expect(resetDurationMs("200ms")).toBe(200);
});
