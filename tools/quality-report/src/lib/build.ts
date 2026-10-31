import type { PipelineJob, QualityBuild } from '@my-resume/api-models';
import type { GithubJob, GithubJobs, GithubRun } from './inputs.ts';
import { secondsBetween } from './numbers.ts';

type CompletedJob = GithubJob & { started_at: string; completed_at: string };

function isCompleted(job: GithubJob): job is CompletedJob {
  return job.status === 'completed' && job.started_at !== null && job.completed_at !== null;
}

/** GitHub Actions run + its jobs → build info; the run lasts until `now`, when the report is assembled. */
export function buildFromGithub(run: GithubRun, jobs: GithubJobs | null, now: Date): QualityBuild {
  const completed: PipelineJob[] = (jobs?.jobs ?? [])
    .filter(isCompleted)
    .map((job) => ({ job, start: new Date(job.started_at) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(({ job, start }) => ({
      name: job.name,
      durationSeconds: secondsBetween(start, new Date(job.completed_at)),
    }));

  return {
    commit: run.head_sha,
    commitUrl: `${run.repository.html_url}/commit/${run.head_sha}`,
    branch: run.head_branch,
    runUrl: run.html_url,
    startedAt: run.run_started_at,
    durationSeconds: secondsBetween(new Date(run.run_started_at), now),
    jobs: completed,
  };
}
