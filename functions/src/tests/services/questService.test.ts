import { UserProfile, QuestItem, LocationInformation } from "../../types";

// Mock the LLM layer and Maps so no network/secrets are touched.
jest.mock("../../llm", () => ({
  planDescribedQuest: jest.fn(),
  generateQuestsWriter: jest.fn(),
  generateGenericQuests: jest.fn(),
  generateLocationConcepts: jest.fn(),
}));
jest.mock("../../integrations/maps", () => ({
  getBestLocation: jest.fn(),
  fetchPlacePhotoBytes: jest.fn(),
}));

import { generateBatch, generateDescribed, attachQuestPhotos } from "../../services/questService";
import {
  generateLocationConcepts,
  planDescribedQuest,
  generateQuestsWriter,
  generateGenericQuests,
} from "../../llm";
import { getBestLocation, fetchPlacePhotoBytes } from "../../integrations/maps";

const profile: UserProfile = {
  interests: ["food"],
  comfortZoneEdges: ["Talking to strangers"],
  vibe: ["chill"],
  experimentationLevel: 3,
  budget: ["moderate"],
  transportation: ["walking"],
  locationPreferences: ["neighborhood"],
  additionalContext: null,
  city: "San Francisco",
};

function item(title: string): QuestItem {
  return {
    title,
    questDescription: "d",
    difficulty: "easy",
    estimatedActivityMinutes: 30,
    categories: [],
  };
}

const loc = {
  name: "Sushi Place",
  address: "1 Main St",
  locationDescription: "",
  latitude: 37.7,
  longitude: -122.4,
  photoReference: "",
  googleMapsURL: "",
} as LocationInformation;

const plan = planDescribedQuest as jest.Mock;
const writer = generateQuestsWriter as jest.Mock;
const generic = generateGenericQuests as jest.Mock;
const maps = getBestLocation as jest.Mock;
const photoBytes = fetchPlacePhotoBytes as jest.Mock;

describe("generateDescribed", () => {
  beforeEach(() => {
    plan.mockReset();
    writer.mockReset();
    generic.mockReset();
    maps.mockReset();
  });

  it("location mode + Maps resolves → uses the location writer with the user intent", async () => {
    plan.mockResolvedValue({ mode: "location", textQuery: "sushi in SF" });
    maps.mockResolvedValue(loc);
    writer.mockResolvedValue([item("Sushi Quest")]);

    const res = await generateDescribed("I want great sushi", profile);

    expect(res?.title).toBe("Sushi Quest");
    // userIntent is the 4th positional arg to the writer.
    expect(writer.mock.calls[0][2]).toBe("I want great sushi"); // userIntent (3rd arg)
    expect(generic).not.toHaveBeenCalled();
  });

  it("location mode but Maps returns null → falls back to generic", async () => {
    plan.mockResolvedValue({ mode: "location", textQuery: "nowhere" });
    maps.mockResolvedValue(null);
    generic.mockResolvedValue([item("At-home Quest")]);

    const res = await generateDescribed("something local", profile);

    expect(res?.title).toBe("At-home Quest");
    expect(writer).not.toHaveBeenCalled();
    expect(generic.mock.calls[0][3]).toBe("something local"); // userIntent (4th arg)
  });

  it("generic mode → never touches Maps", async () => {
    plan.mockResolvedValue({ mode: "generic" });
    generic.mockResolvedValue([item("Journal")]);

    const res = await generateDescribed("help me journal at home", profile);

    expect(res?.title).toBe("Journal");
    expect(maps).not.toHaveBeenCalled();
  });

  it("returns null when generation yields nothing", async () => {
    plan.mockResolvedValue({ mode: "generic" });
    generic.mockResolvedValue([]);

    const res = await generateDescribed("x", profile);
    expect(res).toBeNull();
  });
});

describe("attachQuestPhotos", () => {
  beforeEach(() => photoBytes.mockReset());

  function locationItem(title: string, photoReference: string): QuestItem {
    return { ...item(title), locationInformation: { ...loc, photoReference } };
  }

  it("embeds base64 + content type for quests with a photo reference", async () => {
    photoBytes.mockResolvedValue({ base64: "AAAA", contentType: "image/jpeg" });

    const [result] = await attachQuestPhotos([
      locationItem("Q", "places/a/photos/b"),
    ]);

    expect(result.locationInformation?.photoImageBase64).toBe("AAAA");
    expect(result.locationInformation?.photoContentType).toBe("image/jpeg");
    expect(photoBytes).toHaveBeenCalledWith("places/a/photos/b");
  });

  it("leaves generic (no-location) quests untouched and never fetches", async () => {
    const [result] = await attachQuestPhotos([item("Generic")]);

    expect(result.locationInformation).toBeUndefined();
    expect(photoBytes).not.toHaveBeenCalled();
  });

  it("skips quests with an empty photo reference", async () => {
    const [result] = await attachQuestPhotos([locationItem("Q", "")]);

    expect(result.locationInformation?.photoImageBase64).toBeUndefined();
    expect(photoBytes).not.toHaveBeenCalled();
  });

  it("tolerates a failed fetch (best-effort) — no image, no throw", async () => {
    photoBytes.mockResolvedValue(null);

    const [result] = await attachQuestPhotos([
      locationItem("Q", "places/a/photos/b"),
    ]);

    expect(result.locationInformation?.photoImageBase64).toBeUndefined();
  });
});

it("returns valid writer quests when generic deficit filling fails", async () => {
  (generateLocationConcepts as jest.Mock).mockResolvedValue([{ textQuery: "cafe", intendedDifficulty: "easy" }]);
  maps.mockResolvedValue(loc); writer.mockResolvedValue([item("Valid")]);
  generic.mockRejectedValue(new Error("busy"));
  expect(await generateBatch(profile, 3)).toEqual([item("Valid")]);
});
it("does not claim success when deficit filling fails with no quests", async () => {
  (generateLocationConcepts as jest.Mock).mockResolvedValue([{ textQuery: "cafe", intendedDifficulty: "easy" }]);
  maps.mockResolvedValue(null); generic.mockRejectedValue(new Error("busy"));
  await expect(generateBatch(profile, 3)).rejects.toThrow("busy");
});
