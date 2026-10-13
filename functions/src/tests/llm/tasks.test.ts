// Drive the REAL generateQuestsWriter with a mocked router, to verify the
// server-side verbatim filter on pushesComfortZoneEdges (handoff §3 / criterion 4).
jest.mock("../../llm/router", () => ({ generateStructured: jest.fn() }));
jest.mock("../../integrations/firestore", () => ({ saveGenerationSample: jest.fn() }));

import { generateQuestsWriter } from "../../llm/tasks";
import { generateStructured } from "../../llm/router";
import { UserProfile, LocationInformation } from "../../types";

const mockRouting = generateStructured as jest.Mock;

const profile: UserProfile = {
  interests: ["coffee"],
  comfortZoneEdges: [
    "Talking to strangers",
    "Eating out alone",
    "Physical discomfort",
    "Trying unfamiliar food",
  ],
  vibe: ["chill"],
  experimentationLevel: 3,
  budget: ["moderate"],
  transportation: ["walking"],
  locationPreferences: ["neighborhood"],
  additionalContext: null,
  city: "Saint Paul",
};

const location = {
  name: "Some Cafe",
  address: "1 Main St",
  locationDescription: "",
  latitude: 44.9,
  longitude: -93.1,
  googleMapsURL: "https://maps.google.com/?cid=1",
  photoReference: "",
} as LocationInformation;

function writerResultWith(pushes: string[]) {
  return {
    object: {
      quests: [
        {
          title: "T",
          questDescription: "D",
          difficulty: "moderate",
          estimatedActivityMinutes: 30,
          categories: ["food"],
          assignedLocationId: "loc_0",
          recommendedTransportationMode: "walking",
          locationDescription: "A cozy spot.",
          pushesComfortZoneEdges: pushes,
        },
      ],
    },
    providerUsed: "tokenrouter",
    modelUsed: "test",
    attempts: 1,
    latencyMs: 1,
  };
}

describe("generateQuestsWriter — pushesComfortZoneEdges verbatim filter", () => {
  beforeEach(() => mockRouting.mockReset());

  it("drops invented and rephrased (wrong-case) edges, keeping only verbatim matches in order", async () => {
    mockRouting.mockResolvedValue(
      writerResultWith([
        "Eating out alone", // exact → keep
        "talking to strangers", // wrong case → drop
        "Skydiving", // invented → drop
        "Physical discomfort", // exact → keep
      ])
    );

    const [quest] = await generateQuestsWriter(profile, [location]);

    expect(quest.pushesComfortZoneEdges).toEqual([
      "Eating out alone",
      "Physical discomfort",
    ]);
  });

  it("caps at 3 entries, preserving the model's (weight) order", async () => {
    mockRouting.mockResolvedValue(
      writerResultWith([
        "Trying unfamiliar food",
        "Eating out alone",
        "Physical discomfort",
        "Talking to strangers", // 4th valid → dropped by the cap
      ])
    );

    const [quest] = await generateQuestsWriter(profile, [location]);

    expect(quest.pushesComfortZoneEdges).toEqual([
      "Trying unfamiliar food",
      "Eating out alone",
      "Physical discomfort",
    ]);
  });

  it("yields [] when the model returns no valid edge (client renders nothing)", async () => {
    mockRouting.mockResolvedValue(writerResultWith(["Nonexistent edge"]));

    const [quest] = await generateQuestsWriter(profile, [location]);

    expect(quest.pushesComfortZoneEdges).toEqual([]);
  });
});
