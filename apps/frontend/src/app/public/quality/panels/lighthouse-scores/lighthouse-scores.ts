import { Component, computed, input } from '@angular/core';
import type { LighthouseScores as Scores } from '@my-resume/api-models';
import { lighthouseBand } from '../../quality-view';

/** The four Lighthouse category scores (0..100), with the band named in text. */
@Component({
  selector: 'app-lighthouse-scores',
  templateUrl: './lighthouse-scores.html',
  styleUrl: './lighthouse-scores.scss',
})
export class LighthouseScores {
  readonly scores = input.required<Scores>();

  protected readonly items = computed(() => {
    const s = this.scores();
    return [
      { name: 'Performance', score: s.performance },
      { name: 'Accessibility', score: s.accessibility },
      { name: 'Best practices', score: s.bestPractices },
      { name: 'SEO', score: s.seo },
    ].map((item) => ({ ...item, band: lighthouseBand(item.score) }));
  });
}
