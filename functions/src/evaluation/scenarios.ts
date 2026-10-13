import { UserProfile } from "../types";

export const bounds = { south: 44.90, north: 45.05, west: -93.38, east: -93.19 };
export interface Scenario {
  id: string;
  category: "coffee" | "park" | "art" | "beginner" | "social";
  query: string;
  intent: string;
  split: "tuning" | "heldout";
  pipeline: boolean;
  profile: UserProfile;
}
const coffee = [
  ["North Loop coffee shop Minneapolis", "Do one 25-minute focused writing session alone at a North Loop café; buying one drink is fine."],
  ["Northeast Minneapolis coffee shop", "Spend 45 minutes outlining a personal project alone at a Northeast café."],
  ["Linden Hills coffee shop Minneapolis", "Read and annotate a book for 30 minutes at a Linden Hills café. Do not assume Wi-Fi or outlets."],
  ["Downtown Minneapolis coffee shop", "Make a paper plan for my workday in a downtown café in 20 minutes, with a small purchase."],
  ["Dinkytown coffee shop Minneapolis", "Try a 25-minute solo study session in a Dinkytown café. I am nervous about being there alone."],
  ["Powderhorn Minneapolis coffee shop", "Find a café near Powderhorn for 30 minutes of offline writing on a small budget."],
  ["Longfellow Minneapolis coffee shop", "Do a 45-minute deep-work session at a Longfellow café. I can bring charged devices; do not promise outlets."],
  ["Uptown Minneapolis coffee shop", "Try a café I have not visited for one focused 25-minute session. No social challenge."],
  ["South Minneapolis coffee shop", "Work on an offline draft for 60 minutes in a south Minneapolis café, with breaks and a small purchase."],
  ["Minneapolis coffee shop quiet laptop", "I want a quiet place for a 45-minute laptop work session. Quietness and laptop policy must be treated as unknown unless verified."],
  ["Minneapolis coffee shop free wifi outlets", "Do 30 minutes of research at a café. Wi-Fi and outlets are important; tell me to confirm them rather than inventing availability."],
  ["Minneapolis coffee shop late night", "Write for 30 minutes at a café after 9 pm. Do not claim it is open then without evidence."],
  ["Minneapolis coffee shop wheelchair accessible", "Plan a 25-minute work session at a café. Step-free entry matters and needs confirmation."],
  ["Minneapolis coffee shop library quiet no purchase", "Work at a café for 30 minutes with no spending. Do not assume free seating or permission to stay without ordering."],
  ["Minneapolis silent coffee shop private desk free unlimited seating", "I want a silent café with a free private desk for three hours. If these conditions cannot be verified, state the uncertainty instead of promising them."],
];
const other: Array<[Scenario["category"], string, string]> = [
  ["park", "Minneapolis park walking trail", "Take a 20-minute solo walk at a specific park and notice three things; do not promise trail conditions."],
  ["park", "Minneapolis riverfront park", "Spend 20 minutes sketching by the river at a named park, choosing a safe public spot."],
  ["park", "Minneapolis park accessible paved walking", "Try a short solo park walk; accessible paths need confirmation."],
  ["park", "North Minneapolis park", "Explore one named park in north Minneapolis for 30 minutes without spending money."],
  ["park", "Minneapolis indoor heated botanical garden free midnight", "Visit a garden in cold weather. Do not invent free admission, indoor facilities, or midnight opening."],
  ["art", "Minneapolis art museum", "Visit a specific art museum alone and spend 30 minutes choosing one favorite work; check admission requirements."],
  ["art", "Northeast Minneapolis art gallery", "Try one named gallery and observe three works. Do not invent a current exhibition."],
  ["art", "Minneapolis public sculpture park", "Sketch a sculpture at a named public art location for 20 minutes; no social task."],
  ["art", "Minneapolis local history museum", "Visit a named history museum alone; verify opening and admission before leaving."],
  ["beginner", "Minneapolis pottery studio beginner", "Plan to try beginner pottery at a specific studio; do not invent a class, price, or walk-in availability."],
  ["beginner", "Minneapolis dance studio beginner", "Find a specific studio for a first beginner dance lesson and give a small preparation step; booking must be confirmed."],
  ["beginner", "Minneapolis climbing gym beginner", "Plan a first visit to a specific climbing gym. Instruction, equipment, cost, and access require confirmation."],
  ["social", "Minneapolis bookstore book club", "Find a specific bookstore where I could ask about a book club; do not invent a scheduled event."],
  ["social", "Minneapolis community center activities", "Go to a named community center and ask staff about one activity. Do not claim a group is running today."],
  ["social", "Minneapolis live music venue", "Plan to attend music alone at a named venue; verify a real event, tickets, and age restrictions first."],
];

const tuning = new Set(["coffee-01", "coffee-02", "coffee-03", "coffee-04", "coffee-05", "park-01", "park-02", "art-01", "beginner-01", "social-01"]);
const pipeline = new Set(["coffee-06", "coffee-07", "coffee-08", "coffee-09", "coffee-10", "coffee-11", "park-03", "park-04", "art-02", "beginner-02"]);
const rows: Array<[Scenario["category"], string, string]> = [...coffee.map(([q, i]) => ["coffee", q, i] as [Scenario["category"], string, string]), ...other];
const counts: Record<string, number> = {};
export const scenarios: Scenario[] = rows.map(([category, query, intent], index) => {
  counts[category] = (counts[category] ?? 0) + 1;
  const id = `${category}-${String(counts[category]).padStart(2, "0")}`;
  return { id, category, query, intent, split: tuning.has(id) ? "tuning" : "heldout", pipeline: pipeline.has(id),
    profile: { interests: [category === "coffee" ? "Coffee shops" : category],
      comfortZoneEdges: [category === "coffee" ? "Spending focused time alone in a new public place" : "Trying unfamiliar activities alone"],
      vibe: ["Solo", "Chill"], experimentationLevel: 1 + index % 3,
      budget: [category === "park" || id === "coffee-14" || id === "coffee-15" ? "free" : "cheap"], transportation: [index % 2 === 0 ? "walking" : "publicTransport"],
      locationPreferences: [category === "park" ? "nature" : "neighborhood"], additionalContext: null,
      city: "Minneapolis, Minnesota", cityLatitude: 44.9778, cityLongitude: -93.2650 } };
});
