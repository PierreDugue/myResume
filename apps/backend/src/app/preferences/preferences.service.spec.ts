import type { Repository } from 'typeorm';
import type { Clock } from '../common/clock';
import type { SkillsService } from '../skills/skills.service';
import type { SitePreferencesEntity } from './entities/site-preferences.entity';
import { PreferencesService } from './preferences.service';

/** The page-flag cache of isPageEnabled(), against a stubbed repository (the DB rows are covered by preferences.int.spec.ts). */
describe('PreferencesService.isPageEnabled cache', () => {
  let nowMs: number;
  let stored: Partial<SitePreferencesEntity>;
  let configured = false;
  const find = vi.fn();
  const query = vi.fn();

  const clock: Clock = { now: () => new Date(nowMs) };
  const skills = {
    findByIdsOrFail: vi.fn().mockResolvedValue([]),
    existingIds: vi.fn().mockResolvedValue([]),
  };
  const service = () =>
    new PreferencesService(
      { find, query } as unknown as Repository<SitePreferencesEntity>,
      skills as unknown as SkillsService,
      clock,
      configured,
    );

  beforeEach(() => {
    configured = false;
    nowMs = Date.UTC(2026, 10, 5, 10, 0, 0);
    stored = { pages: { explore: false } };
    find.mockReset().mockImplementation(async () => [stored]);
    query.mockReset().mockImplementation(async () => [stored]);
  });

  it('reads the flags from the repository', async () => {
    const preferences = service();
    expect(await preferences.isPageEnabled('explore')).toBe(false);
    expect(await preferences.isPageEnabled('traces')).toBe(true);
  });

  it('reads once for calls within 5 seconds, whichever page is asked', async () => {
    const preferences = service();
    await preferences.isPageEnabled('explore');
    nowMs += 4999;
    expect(await preferences.isPageEnabled('explore')).toBe(false);
    expect(await preferences.isPageEnabled('traces')).toBe(true);
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('shares one read between concurrent calls', async () => {
    const preferences = service();
    await Promise.all(Array.from({ length: 50 }, () => preferences.isPageEnabled('explore')));
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('reads again after 5 seconds, and sees the new value', async () => {
    const preferences = service();
    expect(await preferences.isPageEnabled('explore')).toBe(false);
    stored = { pages: { explore: true } };
    nowMs += 5000;
    expect(await preferences.isPageEnabled('explore')).toBe(true);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('is up to 5 seconds behind a change it did not make itself', async () => {
    const preferences = service();
    await preferences.isPageEnabled('explore');
    stored = { pages: { explore: true } };
    nowMs += 1000;
    expect(await preferences.isPageEnabled('explore')).toBe(false);
  });

  it('reads again after update(), which is never stale', async () => {
    const preferences = service();
    expect(await preferences.isPageEnabled('explore')).toBe(false);
    stored = { pages: { explore: true } };
    await preferences.update({ pages: { explore: true } });
    nowMs += 1;
    expect(await preferences.isPageEnabled('explore')).toBe(true);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('does not keep a read that was still running when update() cleared the cache', async () => {
    const preferences = service();
    let release: (rows: unknown[]) => void = () => undefined;
    find.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const slow = preferences.isPageEnabled('explore');

    stored = { pages: { explore: true } };
    await preferences.update({ pages: { explore: true } });
    release([{ pages: { explore: false } }]);
    await slow;

    expect(await preferences.isPageEnabled('explore')).toBe(true);
  });

  it('does not cache a failed read', async () => {
    const preferences = service();
    find.mockRejectedValueOnce(new Error('db down'));
    await expect(preferences.isPageEnabled('explore')).rejects.toThrow('db down');
    expect(await preferences.isPageEnabled('explore')).toBe(false);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('get() always reads fresh', async () => {
    const preferences = service();
    await preferences.isPageEnabled('explore');
    stored = { pages: { explore: true } };
    expect((await preferences.get()).pages.explore).toBe(true);
  });
});

/** The assistant switch shares the page-flag cache (one row read caches both). */
describe('PreferencesService.isAssistantEnabled cache', () => {
  let nowMs: number;
  // `assistant` is the new jsonb column of the entity (see the tester's report).
  let stored: Partial<SitePreferencesEntity> & { assistant?: Record<string, unknown> };
  const find = vi.fn();
  const query = vi.fn();

  const clock: Clock = { now: () => new Date(nowMs) };
  const skills = {
    findByIdsOrFail: vi.fn().mockResolvedValue([]),
    existingIds: vi.fn().mockResolvedValue([]),
  };
  const service = (configured = true) =>
    new PreferencesService(
      { find, query } as unknown as Repository<SitePreferencesEntity>,
      skills as unknown as SkillsService,
      clock,
      configured,
    );

  beforeEach(() => {
    nowMs = Date.UTC(2026, 10, 5, 10, 0, 0);
    stored = { pages: {}, assistant: { enabled: true } };
    find.mockReset().mockImplementation(async () => [stored]);
    query.mockReset().mockImplementation(async () => [stored]);
  });

  it('reads the switch from the repository: false without a row or a stored value', async () => {
    expect(await service().isAssistantEnabled()).toBe(true);

    find.mockResolvedValue([]);
    expect(await service().isAssistantEnabled()).toBe(false);
    find.mockResolvedValue([{ pages: {}, assistant: {} }]);
    expect(await service().isAssistantEnabled()).toBe(false);
  });

  it('reads once within 5 seconds, shared with isPageEnabled in both orders', async () => {
    const preferences = service();
    expect(await preferences.isAssistantEnabled()).toBe(true);
    nowMs += 4999;
    expect(await preferences.isPageEnabled('explore')).toBe(true);
    expect(await preferences.isAssistantEnabled()).toBe(true);
    expect(find).toHaveBeenCalledTimes(1);

    const other = service();
    find.mockClear();
    await other.isPageEnabled('explore');
    await other.isAssistantEnabled();
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('is up to 5 seconds behind a change made elsewhere, then sees it', async () => {
    const preferences = service();
    expect(await preferences.isAssistantEnabled()).toBe(true);
    stored = { pages: {}, assistant: { enabled: false } };
    nowMs += 1000;
    expect(await preferences.isAssistantEnabled()).toBe(true);
    nowMs += 4000;
    expect(await preferences.isAssistantEnabled()).toBe(false);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('reads again after update(), in both directions', async () => {
    const preferences = service();
    expect(await preferences.isAssistantEnabled()).toBe(true);
    stored = { pages: {}, assistant: { enabled: false } };
    await preferences.update({ assistant: { enabled: false } });
    nowMs += 1;
    expect(await preferences.isAssistantEnabled()).toBe(false);

    stored = { pages: {}, assistant: { enabled: true } };
    await preferences.update({ assistant: { enabled: true } });
    nowMs += 1;
    expect(await preferences.isAssistantEnabled()).toBe(true);
  });

  it('does not cache a failed read', async () => {
    const preferences = service();
    find.mockRejectedValueOnce(new Error('db down'));
    await expect(preferences.isAssistantEnabled()).rejects.toThrow('db down');
    expect(await preferences.isAssistantEnabled()).toBe(true);
  });

  it('get() reports `configured` from the server setting, not from the row', async () => {
    expect((await service(true).get()).assistant).toEqual({ enabled: true, configured: true });
    expect((await service(false).get()).assistant).toEqual({ enabled: true, configured: false });
  });
});
