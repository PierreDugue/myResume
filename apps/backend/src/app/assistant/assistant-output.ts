export const MAX_ANSWER_LENGTH = 2000;

/** The model's output doesn't match the response schema. */
export class AssistantOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantOutputError';
  }
}

/** Reads the model's JSON output. Throws an `AssistantOutputError` when it isn't usable. */
export function parseAssistantOutput(text: string): {
  answer: string;
  exploreQuery: string | null;
} {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AssistantOutputError('The output is not JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AssistantOutputError('The output is not an object');
  }
  const { answer, exploreQuery } = value as Record<string, unknown>;
  if (typeof answer !== 'string' || answer.trim() === '') {
    throw new AssistantOutputError('The output has no answer');
  }
  const query = typeof exploreQuery === 'string' ? exploreQuery.trim() : '';
  return {
    answer: answer.trim().slice(0, MAX_ANSWER_LENGTH),
    exploreQuery: query === '' ? null : query,
  };
}
