import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AssistantAnswer } from '@my-resume/api-models';
import { firstValueFrom } from 'rxjs';
import { AssistantApi } from './assistant-api.service';

describe('AssistantApi', () => {
  let http: HttpTestingController;
  let api: AssistantApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AssistantApi);
  });

  afterEach(() => http.verify());

  it('posts the question to /api/assistant/ask and returns the answer', async () => {
    const answer: AssistantAnswer = {
      answer: 'Pierre works at KX.',
      explore: { query: '{company="KX"}', matches: 3 },
    };
    const result = firstValueFrom(api.ask('Where does Pierre work?'));
    const req = http.expectOne('/api/assistant/ask');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ question: 'Where does Pierre work?' });
    req.flush(answer);
    expect(await result).toEqual(answer);
  });

  it('lets the error through, so the panel can explain it', async () => {
    const result = firstValueFrom(api.ask('q'));
    http
      .expectOne('/api/assistant/ask')
      .flush(
        { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
        { status: 429, statusText: 'Too Many Requests' },
      );
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    await expect(result).rejects.toMatchObject({ status: 429 });
  });
});
