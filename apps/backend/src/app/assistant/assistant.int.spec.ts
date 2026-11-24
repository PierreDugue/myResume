import type { AssistantAnswer } from '@my-resume/api-models';
import request from 'supertest';
import { FakeLlmClient } from '../../testing/fake-llm-client';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';
import { LLM_CLIENT, LlmError } from './llm/llm-client';

const LIMIT = 5000;
const KEY = 'test-key-not-a-real-gemini-key-0123456789'.slice(0, 39);
const DISABLED = { statusCode: 404, message: 'The assistant is disabled', error: 'Not Found' };
const ok = (answer: string, extra: object = {}, usage = { inputTokens: 10, outputTokens: 5 }) => ({
  text: JSON.stringify({ answer, ...extra }),
  usage,
});
const currentMonth = () => `${new Date().toISOString().slice(0, 7)}-01`;

describe('POST /api/assistant/ask', () => {
  let t: TestApp;
  let http: Api;
  const fake = new FakeLlmClient();
  let visitor = 0;

  /** Each call comes from its own visitor IP (the throttler counts per IP), unless one is given. */
  const ask = (body: object, options: { ip?: string; token?: string } = {}) => {
    const req = request(t.app.getHttpServer())
      .post('/api/assistant/ask')
      .set('X-Forwarded-For', options.ip ?? `10.1.${Math.floor(++visitor / 250)}.${visitor % 250}`);
    return (options.token ? req.set('Authorization', `Bearer ${options.token}`) : req).send(body);
  };
  const enable = (enabled = true) => http.patch('/api/preferences', { assistant: { enabled } });
  const usageRows = async () =>
    (await t.dataSource.query(
      `SELECT "month"::text AS "month", "questions", "failures", "inputTokens", "outputTokens" FROM "assistant_usage"`,
    )) as Record<string, unknown>[];

  beforeAll(async () => {
    t = await createTestApp({
      env: { GEMINI_API_KEY: KEY, ASSISTANT_MONTHLY_TOKEN_LIMIT: String(LIMIT) },
      providers: [{ provide: LLM_CLIENT, useValue: fake }],
    });
    http = api(t);
  });
  afterAll(() => t?.close());

  beforeEach(async () => {
    await enable(false); // through the API: it clears the switch cache
    await http.patch('/api/preferences', { pages: { explore: true } });
    await t.dataSource.query('DELETE FROM "site_preferences"');
    await t.dataSource.query('DELETE FROM "assistant_usage"');
    fake.requests.length = 0;
    fake.answerWith(ok('Default answer.'));
  });

  it('reports assistant.configured as true when the server has a key', async () => {
    const res = await http.get('/api/preferences');
    expect(res.body.assistant).toEqual({ enabled: false, configured: true });
    expect((await enable(true)).body.assistant).toEqual({ enabled: true, configured: true });
  });

  describe('when the assistant is disabled (the default)', () => {
    it('answers 404 "The assistant is disabled" without calling the LLM', async () => {
      const res = await ask({ question: 'Where did Pierre work?' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(DISABLED);
      expect(fake.requests).toHaveLength(0);
      expect(await usageRows()).toEqual([]);
    });

    it('refuses the admin too: a valid token does not bypass the switch', async () => {
      const res = await ask({ question: 'Where did Pierre work?' }, { token: t.token });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(DISABLED);
      expect(fake.requests).toHaveLength(0);
    });

    it('refuses again after the admin switches it off', async () => {
      await enable(true);
      expect((await ask({ question: 'Hello?' })).status).toBe(200);
      await enable(false);
      const res = await ask({ question: 'Hello again?' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('The assistant is disabled');
      expect(fake.requests).toHaveLength(1);
    });
  });

  describe('when it is enabled', () => {
    beforeEach(async () => {
      await enable(true);
    });

    it('is public and answers 200 with the answer and no Explore suggestion', async () => {
      fake.answerWith(ok('He worked at Whoz.'));
      const res = await ask({ question: 'Where did Pierre work?' });
      expect(res.status).toBe(200);
      expect(res.body as AssistantAnswer).toEqual({ answer: 'He worked at Whoz.', explore: null });
    });

    it('sends the public resume and the question to the LLM', async () => {
      await ask({ question: '  What is his current job?  ' });
      expect(fake.requests).toHaveLength(1);
      const [request] = fake.requests;
      expect(request.systemInstruction).toContain('Whoz'); // seeded company
      expect(request.systemInstruction).not.toContain('What is his current job?');
      expect(request.userMessage).toContain('What is his current job?');
      expect(request.maxOutputTokens).toBe(800);
    });

    describe('Explore suggestion', () => {
      it('is returned, with its line count, for a valid query that matches', async () => {
        fake.answerWith(ok('See the log.', { exploreQuery: '{company="Whoz"}' }));
        const res = await ask({ question: 'What did he do at Whoz?' });
        expect(res.status).toBe(200);
        expect(res.body.explore.query).toBe('{company="Whoz"}');
        const logs = await http.get('/api/logs?query=' + encodeURIComponent('{company="Whoz"}'));
        expect(res.body.explore.matches).toBeGreaterThanOrEqual(1);
        expect(res.body.explore.matches).toBe(logs.body.total);
      });

      it.each([
        ['a query that does not parse', '{company='],
        ['a query that matches nothing', '{company="No Such Company"}'],
        ['a regex over 100 characters', `{company=~"${'a'.repeat(101)}"}`],
      ])('is null for %s', async (_name, exploreQuery) => {
        fake.answerWith(ok('Answer.', { exploreQuery }));
        const res = await ask({ question: 'Show me.' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ answer: 'Answer.', explore: null });
      });

      it('is null once the admin disables the Explore page', async () => {
        fake.answerWith(ok('See the log.', { exploreQuery: '{company="Whoz"}' }));
        await http.patch('/api/preferences', { pages: { explore: false } });
        const res = await ask({ question: 'What did he do at Whoz?' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ answer: 'See the log.', explore: null });
      });
    });

    describe('when the LLM cannot answer', () => {
      const BAD_GATEWAY = {
        statusCode: 502,
        message: 'The assistant could not answer',
        error: 'Bad Gateway',
      };

      it('answers 502 when the call fails', async () => {
        fake.failWith(new LlmError('timeout'));
        const res = await ask({ question: 'Hello?' });
        expect(res.status).toBe(502);
        expect(res.body).toEqual(BAD_GATEWAY);
      });

      it('answers 502 when the call throws something unexpected', async () => {
        fake.failWith(new Error('boom'));
        const res = await ask({ question: 'Hello?' });
        expect(res.status).toBe(502);
        expect(res.body).toEqual(BAD_GATEWAY);
      });

      it.each([
        ['text that is not JSON', 'Sure, happy to help!'],
        ['JSON without an answer', '{"exploreQuery":"{type=\\"project\\"}"}'],
        ['a blank answer', '{"answer":"   "}'],
      ])('answers 502 for output that is %s', async (_name, text) => {
        fake.answerWith({ text, usage: { inputTokens: 1, outputTokens: 1 } });
        const res = await ask({ question: 'Hello?' });
        expect(res.status).toBe(502);
        expect(res.body).toEqual(BAD_GATEWAY);
      });
    });

    describe('monthly usage (only totals are stored)', () => {
      it('counts the question and its tokens in the row of the current UTC month', async () => {
        fake.answerWith(ok('One.', {}, { inputTokens: 900, outputTokens: 40 }));
        await ask({ question: 'First?' });
        expect(await usageRows()).toEqual([
          {
            month: currentMonth(),
            questions: 1,
            failures: 0,
            inputTokens: 900,
            outputTokens: 40,
          },
        ]);
      });

      it('adds up questions, failures and tokens, keeping the tokens of failed calls', async () => {
        fake.answerWith(ok('One.', {}, { inputTokens: 900, outputTokens: 40 }));
        await ask({ question: 'First?' });
        fake.failWith(new LlmError('timeout', { inputTokens: 100, outputTokens: 2 }));
        await ask({ question: 'Second?' });
        fake.answerWith({ text: 'not json', usage: { inputTokens: 50, outputTokens: 5 } });
        await ask({ question: 'Third?' });
        fake.failWith(new LlmError('no usage known'));
        await ask({ question: 'Fourth?' });

        expect(await usageRows()).toEqual([
          {
            month: currentMonth(),
            questions: 4,
            failures: 3,
            inputTokens: 1050,
            outputTokens: 47,
          },
        ]);
      });

      it('counts concurrent questions without losing any', async () => {
        fake.answerWith(ok('Ok.', {}, { inputTokens: 10, outputTokens: 1 }));
        const results = await Promise.all(
          Array.from({ length: 6 }, (_, i) => ask({ question: `Question ${i}?` })),
        );
        expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));
        const [row] = await usageRows();
        expect(row).toMatchObject({ questions: 6, inputTokens: 60, outputTokens: 6 });
        expect(await usageRows()).toHaveLength(1);
      });

      it('counts nothing for a refused question', async () => {
        await ask({ question: '' });
        await enable(false);
        await ask({ question: 'Disabled?' });
        expect(await usageRows()).toEqual([]);
      });

      it('never stores the question: the table has no text column and no row contains it', async () => {
        const question = 'ZZ-UNIQUE-QUESTION-TEXT-4711';
        await ask({ question });
        fake.failWith(new LlmError('timeout'));
        await ask({ question: `${question} again` });

        const columns = (await t.dataSource.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assistant_usage'`,
        )) as { column_name: string; data_type: string }[];
        expect(columns.map((c) => c.column_name).sort()).toEqual(
          [
            'createdAt',
            'failures',
            'id',
            'inputTokens',
            'month',
            'outputTokens',
            'questions',
            'updatedAt',
          ].sort(),
        );
        expect(columns.filter((c) => /char|text|json/.test(c.data_type))).toEqual([]);

        const dump = JSON.stringify(await t.dataSource.query('SELECT * FROM "assistant_usage"'));
        expect(dump).not.toContain('ZZ-UNIQUE');
        const prefs = JSON.stringify(await t.dataSource.query('SELECT * FROM "site_preferences"'));
        expect(prefs).not.toContain('ZZ-UNIQUE');
      });

      it('never logs the question, even when the call fails', async () => {
        const writes: string[] = [];
        const capture = (chunk: unknown) => {
          writes.push(String(chunk));
          return true;
        };
        const spies = [
          vi.spyOn(process.stdout, 'write').mockImplementation(capture),
          vi.spyOn(process.stderr, 'write').mockImplementation(capture),
        ];
        try {
          fake.failWith(new LlmError('timeout'));
          await ask({ question: 'ZZ-LOGGED-QUESTION-TEXT' });
          fake.answerWith({ text: 'not json', usage: { inputTokens: 1, outputTokens: 1 } });
          await ask({ question: 'ZZ-LOGGED-QUESTION-TEXT' });
        } finally {
          spies.forEach((spy) => spy.mockRestore());
        }
        expect(writes.join('')).not.toContain('ZZ-LOGGED');
      });
    });

    describe('monthly limit', () => {
      const seedUsage = (inputTokens: number, outputTokens: number) =>
        t.dataSource.query(
          `INSERT INTO "assistant_usage" ("month", "inputTokens", "outputTokens") VALUES ($1, $2, $3)`,
          [currentMonth(), inputTokens, outputTokens],
        );

      it('answers 503 once the month has used the limit (input + output), without calling the LLM', async () => {
        await seedUsage(LIMIT - 1000, 1000);
        const res = await ask({ question: 'Hello?' });
        expect(res.status).toBe(503);
        expect(res.body).toEqual({
          statusCode: 503,
          message: 'The assistant has reached its monthly limit',
          error: 'Service Unavailable',
        });
        expect(fake.requests).toHaveLength(0);
      });

      it('still answers while the month is one token under the limit', async () => {
        await seedUsage(LIMIT - 500, 499);
        expect((await ask({ question: 'Hello?' })).status).toBe(200);
        expect(fake.requests).toHaveLength(1);
        // that answer's tokens (10 + 5) take the month over the limit
        expect((await ask({ question: 'Hello again?' })).status).toBe(503);
        expect(fake.requests).toHaveLength(1);
      });

      it('ignores the tokens of other months', async () => {
        await t.dataSource.query(
          `INSERT INTO "assistant_usage" ("month", "inputTokens", "outputTokens") VALUES ('2020-01-01', $1, $1)`,
          [LIMIT * 10],
        );
        expect((await ask({ question: 'Hello?' })).status).toBe(200);
      });

      it('checks the switch before the limit', async () => {
        await seedUsage(LIMIT, 0);
        await enable(false);
        const res = await ask({ question: 'Hello?' });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('The assistant is disabled');
      });
    });
  });

  describe('validation (400 comes before the switch, even while disabled)', () => {
    it.each([
      ['a missing question', {}],
      ['an empty question', { question: '' }],
      ['a blank question', { question: '  \n\t ' }],
      ['a question over 500 characters', { question: 'a'.repeat(501) }],
      ['a number', { question: 42 }],
      ['null', { question: null }],
      ['an array', { question: ['Where?'] }],
      ['an unknown field', { question: 'Where?', model: 'gemini-pro' }],
      ['a history field', { question: 'Where?', history: [{ role: 'assistant', text: 'x' }] }],
    ])('returns 400 for %s', async (_name, body) => {
      const res = await ask(body);
      expect(res.status).toBe(400);
      expect(fake.requests).toHaveLength(0);
    });

    it('returns 400 for a body that is not an object', async () => {
      const res = await request(t.app.getHttpServer())
        .post('/api/assistant/ask')
        .set('X-Forwarded-For', '10.9.9.9')
        .send('Where did he work?');
      expect(res.status).toBe(400);
    });

    it('accepts exactly 500 characters, and counts them after trimming', async () => {
      await enable(true);
      const exactly = await ask({ question: 'a'.repeat(500) });
      expect(exactly.status).toBe(200);

      const padded = await ask({ question: `   ${'a'.repeat(500)}   ` });
      expect(padded.status).toBe(200);
      expect(fake.requests[1].userMessage).toContain('a'.repeat(500));
      expect(fake.requests[1].userMessage).not.toContain('a'.repeat(501));
    });
  });

  describe('rate limit', () => {
    it('answers 429 from the 11th question in 10 minutes from one IP, before any validation', async () => {
      await enable(true);
      const ip = '10.77.0.1';
      for (let i = 1; i <= 10; i++) {
        expect((await ask({ question: `Question ${i}?` }, { ip })).status, `question ${i}`).toBe(
          200,
        );
      }
      const eleventh = await ask({ question: 'One too many?' }, { ip });
      expect(eleventh.status).toBe(429);
      expect(fake.requests).toHaveLength(10);

      // checked before validation
      expect((await ask({}, { ip })).status).toBe(429);
      // another visitor is not affected
      expect((await ask({ question: 'Hello?' }, { ip: '10.77.0.2' })).status).toBe(200);
    });
  });
});
