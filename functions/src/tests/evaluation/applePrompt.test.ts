import { buildAppleWriterPrompt, freezeApplePrompt } from "../../evaluation/applePrompt";
import { Checkpoint } from "../../evaluation/core";
import { scenarios } from "../../evaluation/scenarios";
import { buildQuestWriterPrompt } from "../../utils/prompts";

test("one Apple adaptation preserves venue evidence/request while removing unrelated exemplars", () => {
  const scenario = scenarios[0], venue = { id: "loc_0", name: "Fixture Café", address: "Fixture Address", latitude: 44.98,
    longitude: -93.26, transportationOptions: [{ mode: "walking", estimatedTravelMinutes: 1, isRecommended: false }] };
  const original = buildQuestWriterPrompt(scenario.profile, [venue], scenario.intent);
  const adapted = buildAppleWriterPrompt(original, scenario, venue);
  expect(original).toContain("ask the barista"); expect(adapted).not.toContain("ask the barista");
  expect(adapted).toContain(scenario.intent);
  const venueJSON = adapted.split("LOCATIONS:\n")[1].split("\n\nRULES:")[0];
  expect(JSON.parse(venueJSON)).toEqual([venue]);
  expect(adapted).toContain(JSON.stringify(scenario.profile.comfortZoneEdges));
  expect(adapted).not.toContain("budget");
});
test("frozen adaptation cannot change on resume", () => {
  const state: Checkpoint = { version: 1, manifest: "fixture", createdAt: "fixture", native: {}, results: [], calls: {}, frozen: false };
  freezeApplePrompt(state, "first"); expect(state.frozen).toBe(true);
  expect(() => freezeApplePrompt(state, "first")).not.toThrow();
  expect(() => freezeApplePrompt(state, "changed")).toThrow("Frozen Apple adaptation changed");
});
