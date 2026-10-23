import { Component, computed, input } from '@angular/core';
import type { Impact, ImpactItem } from '@my-resume/api-models';

export interface FormattedImpact {
  headline: string;
  detail: string | null;
  trend: 'up' | 'down' | 'flat';
  /** The change goes the way that is good for this metric. */
  good: boolean;
}

const MINUS = '−';

/** Turns an impact into the big number, an optional "before → after", and its trend. */
export function formatImpact(impact: Impact): FormattedImpact {
  const unit = impact.unit ?? '';
  const value = (n: number) => `${n}${unit}`;
  const isGood = (trend: FormattedImpact['trend']) =>
    trend === 'flat' || (impact.direction === 'up-is-good') === (trend === 'up');
  const comparison =
    impact.before !== null && impact.after !== null
      ? `${value(impact.before)} → ${value(impact.after)}`
      : null;

  if (impact.changePct !== null) {
    const pct = impact.changePct;
    const trend = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    const sign = pct > 0 ? '+' : pct < 0 ? MINUS : '';
    return { headline: `${sign}${Math.abs(pct)}%`, detail: comparison, trend, good: isGood(trend) };
  }
  if (impact.before !== null && impact.after !== null) {
    const trend =
      impact.after > impact.before ? 'up' : impact.after < impact.before ? 'down' : 'flat';
    return { headline: value(impact.after), detail: comparison, trend, good: isGood(trend) };
  }
  const only = impact.after ?? impact.before;
  return { headline: only === null ? '–' : value(only), detail: null, trend: 'flat', good: true };
}

/** Quantified achievements as before/after metric cards. */
@Component({
  selector: 'app-impact-list',
  templateUrl: './impact-list.html',
  styleUrl: './impact-list.scss',
})
export class ImpactList {
  readonly items = input.required<ImpactItem[]>();

  protected readonly cards = computed(() =>
    this.items().map((item) => {
      const f = formatImpact(item.impact);
      const { before, after } = item.impact;
      return {
        item,
        f,
        year: item.date.slice(0, 4),
        trendText:
          f.trend === 'flat'
            ? null
            : `${f.trend === 'up' ? 'increase' : 'decrease'}, ${f.good ? 'an improvement' : 'a regression'}`,
        step: before !== null && after !== null ? stepPath(before, after) : null,
      };
    }),
  );
}

/** A two-level step line (before, then after), scaled to a 100×32 box. */
function stepPath(before: number, after: number): string {
  const max = Math.max(before, after, 1);
  const y = (v: number) => 30 - (v / max) * 26;
  return `M0 ${y(before)} H50 V${y(after)} H100`;
}
