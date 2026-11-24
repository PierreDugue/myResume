import request from 'supertest';
import { Api, api, createTestApp, TestApp } from '../../testing/test-app';

describe('The assistant without a GEMINI_API_KEY', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    // An empty value counts as "not set", whatever the developer's own .env holds.
    t = await createTestApp({ env: { GEMINI_API_KEY: '' } });
    http = api(t);
  });
  afterAll(() => t?.close());

  beforeEach(async () => {
    await http.patch('/api/preferences', { assistant: { enabled: false } });
    await t.dataSource.query('DELETE FROM "site_preferences"');
  });

  const ask = () =>
    request(t.app.getHttpServer())
      .post('/api/assistant/ask')
      .send({ question: 'Where did he work?' });

  it('reports assistant.configured as false to everyone', async () => {
    const res = await http.get('/api/preferences');
    expect(res.status).toBe(200);
    expect(res.body.assistant).toEqual({ enabled: false, configured: false });
  });

  it('still lets the admin switch it on, and reports configured: false', async () => {
    const res = await http.patch('/api/preferences', { assistant: { enabled: true } });
    expect(res.status).toBe(200);
    expect(res.body.assistant).toEqual({ enabled: true, configured: false });
  });

  it('answers 404 "The assistant is disabled" while it is off', async () => {
    const res = await ask();
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('The assistant is disabled');
  });

  it('answers 404 "The assistant is not configured" once it is switched on', async () => {
    await http.patch('/api/preferences', { assistant: { enabled: true } });
    const res = await ask();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'The assistant is not configured',
      error: 'Not Found',
    });
  });

  it('answers 404 to the admin as well', async () => {
    await http.patch('/api/preferences', { assistant: { enabled: true } });
    const res = await ask().set('Authorization', `Bearer ${t.token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('The assistant is not configured');
  });
});
