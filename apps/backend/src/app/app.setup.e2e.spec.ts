import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { configureApp } from './app.setup';

class EchoDto {
  @IsString()
  name!: string;
}

@Controller('probe')
class ProbeController {
  @Get()
  get() {
    return { ok: true };
  }

  @Post()
  post(@Body() body: EchoDto) {
    return { isDto: body instanceof EchoDto, body };
  }
}

describe('configureApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('serves every route under the /api prefix', async () => {
    await request(app.getHttpServer()).get('/api/probe').expect(200, { ok: true });
    await request(app.getHttpServer()).get('/probe').expect(404);
  });

  it('rejects an invalid body with 400 and a list of messages', async () => {
    const res = await request(app.getHttpServer()).post('/api/probe').send({ name: 42 });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('rejects properties that are not declared in the DTO', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/probe')
      .send({ name: 'ok', isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.message.join(' ')).toContain('isAdmin');
  });

  it('transforms a valid body into a DTO instance', async () => {
    const res = await request(app.getHttpServer()).post('/api/probe').send({ name: 'ok' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ isDto: true, body: { name: 'ok' } });
  });
});
