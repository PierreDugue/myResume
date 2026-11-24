/** `POST /api/assistant/ask` body. */
export interface AskAssistantRequest {
  question: string; // trimmed, 1..500 characters
}

export interface ExploreSuggestion {
  query: string; // an Explore query that parses with @my-resume/query-parser; at most 500 characters
  matches: number; // >= 1: the lines it matches over the default range
}

export interface AssistantAnswer {
  answer: string; // plain text, may contain line breaks, at most 2000 characters
  explore: ExploreSuggestion | null;
}
