import {
  describePlanSchema,
  locationConceptsSchema,
  writerQuestsSchema,
  genericQuestsSchema,
} from "../../llm/schemas";

describe("locationConceptsSchema", () => {
  it("accepts a valid concepts object", () => {
    const parsed = locationConceptsSchema.parse({
      locationConcepts: [{ textQuery: "coffee in SF", intendedDifficulty: "easy" }],
    });
    expect(parsed.locationConcepts).toHaveLength(1);
  });

  it("rejects an invalid difficulty enum", () => {
    expect(() =>
      locationConceptsSchema.parse({
        locationConcepts: [{ textQuery: "x", intendedDifficulty: "trivial" }],
      })
    ).toThrow();
  });
});

describe("writerQuestsSchema", () => {
  const valid = {
    quests: [
      {
        title: "T",
        questDescription: "D",
        difficulty: "moderate",
        estimatedActivityMinutes: 60,
        categories: ["food"],
        assignedLocationId: "loc_0",
        recommendedTransportationMode: "walking",
        locationDescription: "A cozy neighborhood spot.",
        pushesComfortZoneEdges: ["Talking to strangers"],
      },
    ],
  };

  it("accepts a valid writer object", () => {
    expect(writerQuestsSchema.parse(valid).quests[0].title).toBe("T");
  });

  it("requires pushesComfortZoneEdges", () => {
    const { pushesComfortZoneEdges, ...withoutEdges } = valid.quests[0];
    void pushesComfortZoneEdges;
    expect(() =>
      writerQuestsSchema.parse({ quests: [withoutEdges] })
    ).toThrow();
  });

  it("rejects a non-integer estimatedActivityMinutes", () => {
    const bad = {
      quests: [{ ...valid.quests[0], estimatedActivityMinutes: 12.5 }],
    };
    expect(() => writerQuestsSchema.parse(bad)).toThrow();
  });

  it("rejects an out-of-enum transport mode", () => {
    const bad = {
      quests: [
        { ...valid.quests[0], recommendedTransportationMode: "teleport" },
      ],
    };
    expect(() => writerQuestsSchema.parse(bad)).toThrow();
  });
});

describe("genericQuestsSchema", () => {
  it("accepts a location-agnostic quest (no assignedLocationId)", () => {
    const parsed = genericQuestsSchema.parse({
      quests: [
        {
          title: "T",
          questDescription: "D",
          difficulty: "easy",
          estimatedActivityMinutes: 30,
          categories: ["home"],
        },
      ],
    });
    expect(parsed.quests).toHaveLength(1);
  });
});

it("planner requires nullable textQuery, normalized before Maps", () => {
  expect(describePlanSchema.parse({ mode: "generic", textQuery: null })).toEqual({ mode: "generic", textQuery: null });
  expect(() => describePlanSchema.parse({ mode: "generic" })).toThrow();
});
