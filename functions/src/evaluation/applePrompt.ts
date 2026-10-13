import { Scenario } from "./scenarios";
import { Checkpoint } from "./core";

export const appleHeldoutVariant = "compact-allowlists-v1";

// The single adaptation, selected on the ten tuning scenarios: remove the
// unrelated barista example that the native model repeatedly copied, compact
// identical venue evidence, and restate existing reference/mode/edge values.
// Do not add facts or profile fields that the baseline cloud Writer cannot see.
export function buildAppleWriterPrompt(baseline: string, scenario: Scenario, venue: Record<string, unknown>): string {
  const withoutExample = baseline.replace(/\(e\.g\. edge "Talking to strangers" at a cafe -> "[^"]*"\)/, "");
  const compact = withoutExample.replace(/LOCATIONS:\n[\s\S]*?\n\nRULES:/, `LOCATIONS:\n${JSON.stringify([venue])}\n\nRULES:`);
  const constraints = { assignedLocationId: "loc_0", allowedTransportationModes: scenario.profile.transportation,
    allowedComfortZoneEdges: scenario.profile.comfortZoneEdges };
  return `${compact}\n\nEXACT FIELD VALUES (copy from these lists; no other values):\n${JSON.stringify(constraints)}\nThe requested action is the quest. Solo focused work counts as acting on the supplied solo-focus edge. Do not introduce a new social task unless the user requested one. Use categories describing the requested activity.\n`;
}

export function freezeApplePrompt(state: Checkpoint, hash: string): void {
  if (state.frozen && state.native.appleHeldoutPromptHash !== hash) throw new Error("Frozen Apple adaptation changed; start a new experiment.");
  state.native.appleHeldoutPromptHash = hash;
  state.native.applePromptVersions = { tuning: "initial-production-task-with-evidence-boundary", heldout: appleHeldoutVariant };
  state.frozen = true;
}
