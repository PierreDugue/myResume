import request from 'supertest';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

describe('The assistant with a blank GEMINI_API_KEY', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp({ env: { GEMINI_API_KEY: '   ' } });
    http = api(t);
  });
  afterAll(() => t?.close());

  it('is not configured: spaces are not a key', async () => {
    const res = await http.get('/api/preferences');
    expect(res.body.assistant.configured).toBe(false);
  });

  it('answers 404 "The assistant is not configured" once the admin switches it on', async () => {
    const enabled = await http.patch('/api/preferences', { assistant: { enabled: true } });
    expect(enabled.body.assistant).toEqual({ enabled: true, configured: false });

    const res = await request(t.app.getHttpServer())
      .post('/api/assistant/ask')
      .send({ question: 'Where did he work?' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('The assistant is not configured');
  });
});
