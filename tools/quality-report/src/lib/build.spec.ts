import type { GithubJobs, GithubRun } from './inputs.ts';
import { buildFromGithub } from './build.ts';

const run: GithubRun = {
  head_sha: '0123456789abcdef0123456789abcdef01234567',
  head_branch: 'main',
  html_url: 'https://github.com/octo/my-resume/actions/runs/42',
  run_started_at: '2026-10-31T10:00:00Z',
  repository: { html_url: 'https://github.com/octo/my-resume' },
};

const jobs: GithubJobs = {
  jobs: [
    {
      name: 'Unit tests',
      status: 'completed',
      started_at: '2026-10-31T10:00:20Z',
      completed_at: '2026-10-31T10:02:20Z',
    },
    {
      name: 'Lint and typecheck',
      status: 'completed',
      started_at: '2026-10-31T10:00:10Z',
      completed_at: '2026-10-31T10:01:40.600Z',
    },
    // the quality job itself, still running
    {
      name: 'Quality report',
      status: 'in_progress',
      started_at: '2026-10-31T10:03:00Z',
      completed_at: null,
    },
    { name: 'Publish', status: 'queued', started_at: null, completed_at: null },
    {
      name: 'Build frontend',
      status: 'completed',
      started_at: '2026-10-31T10:00:15Z',
      completed_at: '2026-10-31T10:00:59Z',
    },
  ],
};

describe('buildFromGithub', () => {
  const now = new Date('2026-10-31T10:03:30.400Z');

  it('describes the run: commit, links, branch, start and duration until now', () => {
    const build = buildFromGithub(run, jobs, now);
    expect(build).toMatchObject({
      commit: '0123456789abcdef0123456789abcdef01234567',
      commitUrl:
        'https://github.com/octo/my-resume/commit/0123456789abcdef0123456789abcdef01234567',
      branch: 'main',
      runUrl: 'https://github.com/octo/my-resume/actions/runs/42',
      startedAt: '2026-10-31T10:00:00Z',
      // 3 min 30.4 s
      durationSeconds: 210,
    });
  });

  it('lists only the completed jobs, in start order, with their duration in whole seconds', () => {
    expect(buildFromGithub(run, jobs, now).jobs).toEqual([
      { name: 'Lint and typecheck', durationSeconds: 91 }, // 90.6 s
      { name: 'Build frontend', durationSeconds: 44 },
      { name: 'Unit tests', durationSeconds: 120 },
    ]);
  });

  it('keeps a null branch (e.g. a tag)', () => {
    expect(buildFromGithub({ ...run, head_branch: null }, jobs, now).branch).toBeNull();
  });

  it('has no jobs without the jobs file', () => {
    expect(buildFromGithub(run, null, now).jobs).toEqual([]);
  });
});
