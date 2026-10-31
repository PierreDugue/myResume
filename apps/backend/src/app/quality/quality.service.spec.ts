import { Logger } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { qualityReportFixture } from '../../testing/quality-report.fixture';
import { QualityService } from './quality.service';

const report = qualityReportFixture;

describe('QualityService', () => {
  let dir: string;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'quality-'));
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    warn.mockRestore();
    await rm(dir, { recursive: true, force: true });
  });

  async function fileWith(content: string): Promise<string> {
    const path = join(dir, 'quality-report.json');
    await writeFile(path, content);
    return path;
  }

  it('returns the report from the file', async () => {
    const service = new QualityService(await fileWith(JSON.stringify(report)));

    await expect(service.get()).resolves.toEqual(report);
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns null, without a warning, when the file does not exist', async () => {
    const service = new QualityService(join(dir, 'missing.json'));

    await expect(service.get()).resolves.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns null and warns once, without the file contents, when the JSON is malformed', async () => {
    const service = new QualityService(await fileWith('{ "secret-marker": '));

    await expect(service.get()).resolves.toBeNull();
    await expect(service.get()).resolves.toBeNull();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('secret-marker');
  });

  it('returns null and warns when the schemaVersion is not 1', async () => {
    const service = new QualityService(
      await fileWith(JSON.stringify({ ...report, schemaVersion: 2 })),
    );

    await expect(service.get()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an array', '[]'],
    ['null', 'null'],
    ['a string', '"report"'],
    ['a number', '1'],
  ])('returns null and warns when the file contains %s', async (_name, content) => {
    const service = new QualityService(await fileWith(content));

    await expect(service.get()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns null and warns when the path cannot be read (a directory)', async () => {
    const service = new QualityService(dir);

    await expect(service.get()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reads the file only once, even for concurrent calls', async () => {
    const path = await fileWith(JSON.stringify(report));
    const service = new QualityService(path);

    const [first, second] = await Promise.all([service.get(), service.get()]);
    await writeFile(path, JSON.stringify({ ...report, generatedAt: '2030-01-01T00:00:00.000Z' }));
    const third = await service.get();

    expect(first).toEqual(report);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('does not read the file before the first call', async () => {
    const path = await fileWith('not json');
    const service = new QualityService(path);
    await writeFile(path, JSON.stringify(report));

    await expect(service.get()).resolves.toEqual(report);
  });
});
