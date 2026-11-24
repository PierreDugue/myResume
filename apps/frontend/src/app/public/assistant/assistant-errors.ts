import { HttpErrorResponse } from '@angular/common/http';

const GENERIC = "The assistant couldn't answer. Try again in a moment.";

/** The message shown under a question the assistant could not answer. */
export function assistantErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return GENERIC;
  if (error.status === 429) {
    return "You've asked a lot of questions in a short time. Try again in a few minutes.";
  }
  if (error.status === 0) return 'The server could not be reached. Try again.';
  if (error.status === 404 || error.status === 502 || error.status === 503) {
    const body: unknown = error.error;
    if (typeof body === 'object' && body !== null) {
      const { statusCode, message } = body as { statusCode?: unknown; message?: unknown };
      if (typeof statusCode === 'number' && typeof message === 'string' && message.trim()) {
        return /[.!?]$/.test(message) ? message : `${message}.`;
      }
    }
  }
  return GENERIC;
}
