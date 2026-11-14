import { CACHE_MANAGER, Cache, CacheModule } from '@nestjs/cache-manager';
import { Inject, Injectable, Module } from '@nestjs/common';
import type { ResumeResponse } from '@my-resume/api-models';

/** How long the public resume is reused without a write (docs/api-contract.md, Content). */
export const RESUME_CACHE_TTL_MS = 60_000;

const KEY = 'resume';

/**
 * The public resume, kept in the Nest cache (`@nestjs/cache-manager`): every public read endpoint
 * (resume, dashboard, logs, traces, service map) needs it, and it costs five queries while changing
 * only when the admin edits content. Writes clear it through `InvalidateResumeCacheInterceptor`, so
 * this instance is never stale; the TTL bounds how stale another instance, or an edit made directly
 * in the database, can be.
 *
 * Not `cache.wrap()`: it always stores what it loaded, so a load that started before a write could
 * put the old resume back right after `invalidate()`. Here concurrent readers share one pending load
 * (as `wrap` would), and a load is only stored if no `invalidate()` happened while it ran.
 */
@Injectable()
export class ResumeCache {
  /** The load in progress, shared by concurrent readers who found nothing cached. */
  private pending: Promise<ResumeResponse> | null = null;
  /** Bumped by `invalidate()`: a load started under an older generation is not stored. */
  private generation = 0;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get(load: () => Promise<ResumeResponse>): Promise<ResumeResponse> {
    const cached = await this.cache.get<ResumeResponse>(KEY);
    if (cached !== undefined) return cached;
    this.pending ??= this.loadAndStore(load);
    return this.pending;
  }

  /** Drops the cached resume, and detaches a load still running: it can't store its older data. */
  async invalidate(): Promise<void> {
    this.generation++;
    this.pending = null;
    await this.cache.del(KEY);
  }

  private loadAndStore(load: () => Promise<ResumeResponse>): Promise<ResumeResponse> {
    const pending = this.loadThenStore(load, this.generation).finally(() => {
      // A failed load is not kept, and a finished one is now in the cache.
      if (this.pending === pending) this.pending = null;
    });
    return pending;
  }

  private async loadThenStore(
    load: () => Promise<ResumeResponse>,
    generation: number,
  ): Promise<ResumeResponse> {
    const resume = await load();
    if (generation === this.generation) await this.cache.set(KEY, resume, RESUME_CACHE_TTL_MS);
    return resume;
  }
}

/** Imported by `ResumeModule` and by every content module whose writes must clear the cache. */
@Module({
  imports: [CacheModule.register()],
  providers: [ResumeCache],
  exports: [ResumeCache],
})
export class ResumeCacheModule {}
