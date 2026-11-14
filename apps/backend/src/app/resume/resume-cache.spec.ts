import type { ResumeResponse } from '@my-resume/api-models';
import { createCache } from 'cache-manager';
import { ResumeCache, RESUME_CACHE_TTL_MS } from './resume-cache';

const resume = (fullName: string): ResumeResponse =>
  ({
    profile: { fullName },
    experiences: [],
    education: [],
    skills: [],
    projects: [],
  }) as unknown as ResumeResponse;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** On the in-memory store `CacheModule.register()` uses, with the system time faked for the TTL. */
describe('ResumeCache', () => {
  let cache: ResumeCache;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 10, 14));
    cache = new ResumeCache(createCache());
  });
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);
  /** `get()` looks in the store before loading: wait until the load has really started. */
  const startedLoading = (load: () => unknown) => vi.waitFor(() => expect(load).toHaveBeenCalled());

  it('loads on the first read and reuses the value until the TTL ends', async () => {
    const load = vi.fn(async () => resume('A'));

    expect(await cache.get(load)).toEqual(resume('A'));
    advance(RESUME_CACHE_TTL_MS - 1);
    expect(await cache.get(load)).toEqual(resume('A'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads again once the TTL has passed', async () => {
    const load = vi
      .fn<() => Promise<ResumeResponse>>()
      .mockResolvedValueOnce(resume('A'))
      .mockResolvedValueOnce(resume('B'));

    await cache.get(load);
    // Keyv keeps an entry while `now <= expires`: it is gone 1 ms after the TTL.
    advance(RESUME_CACHE_TTL_MS + 1);
    expect(await cache.get(load)).toEqual(resume('B'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one pending load between concurrent readers', async () => {
    const pending = deferred<ResumeResponse>();
    const load = vi.fn(() => pending.promise);

    const first = cache.get(load);
    const second = cache.get(load);
    pending.resolve(resume('A'));

    expect(await Promise.all([first, second])).toEqual([resume('A'), resume('A')]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not keep a failed load: its readers get the error and the next read tries again', async () => {
    const pending = deferred<ResumeResponse>();
    const load = vi
      .fn<() => Promise<ResumeResponse>>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(resume('A'));

    const first = cache.get(load);
    const second = cache.get(load);
    pending.reject(new Error('database down'));

    await expect(first).rejects.toThrow('database down');
    await expect(second).rejects.toThrow('database down');
    expect(await cache.get(load)).toEqual(resume('A'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('loads again after invalidate()', async () => {
    const load = vi
      .fn<() => Promise<ResumeResponse>>()
      .mockResolvedValueOnce(resume('A'))
      .mockResolvedValueOnce(resume('B'));

    await cache.get(load);
    await cache.invalidate();
    expect(await cache.get(load)).toEqual(resume('B'));
  });

  it('does not keep a load that was pending when invalidate() was called', async () => {
    const old = deferred<ResumeResponse>();
    const load = vi
      .fn<() => Promise<ResumeResponse>>()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(resume('new'));

    const before = cache.get(load);
    await startedLoading(load);
    await cache.invalidate();
    old.resolve(resume('old'));

    // Its own reader still gets it, but later reads load the data written since.
    expect(await before).toEqual(resume('old'));
    expect(await cache.get(load)).toEqual(resume('new'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the newer entry when a load started before invalidate() fails', async () => {
    const old = deferred<ResumeResponse>();
    const fresh = deferred<ResumeResponse>();
    const load = vi
      .fn<() => Promise<ResumeResponse>>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);

    const before = cache.get(load);
    await startedLoading(load);
    await cache.invalidate();
    const after = cache.get(load);
    old.reject(new Error('timeout'));
    await expect(before).rejects.toThrow('timeout');
    fresh.resolve(resume('new'));

    expect(await after).toEqual(resume('new'));
    expect(await cache.get(load)).toEqual(resume('new'));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
