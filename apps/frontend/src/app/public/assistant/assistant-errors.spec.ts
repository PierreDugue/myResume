import { HttpErrorResponse } from '@angular/common/http';
import { assistantErrorMessage } from './assistant-errors';

const nest = (statusCode: number, message: unknown, error = 'Error') =>
  new HttpErrorResponse({ status: statusCode, error: { statusCode, message, error } });
const GENERIC = "The assistant couldn't answer. Try again in a moment.";

describe('assistantErrorMessage', () => {
  it.each<[string, unknown, string]>([
    [
      'the rate limit (429)',
      nest(429, 'ThrottlerException: Too Many Requests'),
      "You've asked a lot of questions in a short time. Try again in a few minutes.",
    ],
    [
      'an unreachable server (status 0)',
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
      'The server could not be reached. Try again.',
    ],
    ['404 with a Nest body', nest(404, 'The assistant is disabled'), 'The assistant is disabled.'],
    [
      '404 "not configured"',
      nest(404, 'The assistant is not configured'),
      'The assistant is not configured.',
    ],
    [
      '503 with a Nest body',
      nest(503, 'The assistant has reached its monthly limit'),
      'The assistant has reached its monthly limit.',
    ],
    [
      '502 with a Nest body',
      nest(502, 'The assistant could not answer'),
      'The assistant could not answer.',
    ],
    ['a message that already ends with a full stop', nest(404, 'Gone.'), 'Gone.'],
    ['a message that ends with another punctuation mark', nest(503, 'Busy!'), 'Busy!'],
    [
      'a 502 from nginx, with an HTML body',
      new HttpErrorResponse({ status: 502, error: '<html><body>Bad Gateway</body></html>' }),
      GENERIC,
    ],
    [
      'a 504 from nginx, with an HTML body',
      new HttpErrorResponse({ status: 504, error: '<html>Gateway Time-out</html>' }),
      GENERIC,
    ],
    ['a Nest body whose message is not a string', nest(502, ['a', 'b']), GENERIC],
    ['a 404 with no body', new HttpErrorResponse({ status: 404 }), GENERIC],
    ['a Nest 500', nest(500, 'Internal server error'), GENERIC],
    ['a Nest 400 (the form prevents it)', nest(400, ['question must not be empty']), GENERIC],
    ['an error that is not an HTTP error', new Error('boom'), GENERIC],
    ['something that is not an error at all', 'boom', GENERIC],
  ])('%s', (_name, error, expected) => {
    expect(assistantErrorMessage(error)).toBe(expected);
  });
});
