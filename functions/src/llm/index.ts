/**
 * Public API of the provider-agnostic LLM layer. The controller imports the
 * four task functions from here; internally they use Luna with shared admission and a foreground-only Groq fallback.
 */
export {
  generateLocationConcepts,
  generateQuestsWriter,
  generateGenericQuests,
  planDescribedQuest,
} from "./tasks";
