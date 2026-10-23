import { Component, computed, input } from '@angular/core';
import type { DashboardRange, TimelineItem } from '@my-resume/api-models';
import { monthIndex } from '@my-resume/resume-metrics';
import { formatPeriod } from '../../../../shared/format/period';

interface Bar {
  id: string;
  kind: TimelineItem['kind'];
  label: string;
  sublabel: string | null;
  period: string;
  left: number;
  width: number;
}

/**
 * Jobs and education as bars on a year axis (plain HTML, readable by screen readers).
 * Periods between jobs are simply empty: no gap markers (see docs/spec.md).
 */
@Component({
  selector: 'app-career-timeline',
  templateUrl: './career-timeline.html',
  styleUrl: './career-timeline.scss',
})
export class CareerTimeline {
  readonly items = input.required<TimelineItem[]>();
  readonly range = input.required<DashboardRange>();
  /** `YYYY-MM-DD`: where ongoing items end. */
  readonly today = input.required<string>();

  private readonly bars = computed<Bar[]>(() => {
    const { from, to } = this.range();
    const first = from * 12;
    const last = to * 12 + 11;
    const total = last - first + 1;
    const now = monthIndex(this.today());
    return this.items().flatMap((item) => {
      const start = Math.max(monthIndex(item.startDate), first);
      const end = Math.min(item.endDate ? monthIndex(item.endDate) : now, last);
      if (end < start) return [];
      return [
        {
          id: item.id,
          kind: item.kind,
          label: item.label,
          sublabel: item.sublabel,
          period: formatPeriod(item.startDate, item.endDate),
          left: ((start - first) / total) * 100,
          width: ((end - start + 1) / total) * 100,
        },
      ];
    });
  });

  protected readonly lanes = computed(() =>
    [
      { title: 'Jobs', bars: this.bars().filter((b) => b.kind === 'job') },
      { title: 'Education', bars: this.bars().filter((b) => b.kind === 'education') },
    ].filter((lane) => lane.bars.length > 0),
  );

  protected readonly ticks = computed(() => {
    const { from, to } = this.range();
    const count = to - from + 1;
    const step = Math.ceil(count / 16);
    return Array.from({ length: count }, (_, i) => from + i).map((year, i) => ({
      year,
      left: (i / count) * 100,
      shown: i % step === 0,
    }));
  });
}
