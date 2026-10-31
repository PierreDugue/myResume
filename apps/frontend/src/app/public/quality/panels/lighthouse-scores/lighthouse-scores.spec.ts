import { TestBed } from '@angular/core/testing';
import type { LighthouseScores } from '@my-resume/api-models';
import { $ } from '../../../../testing';
import { lighthouseQualityFixture } from '../../testing/quality-fixture';
import { LighthouseScores as LighthouseScoresPanel } from './lighthouse-scores';

async function render(scores: LighthouseScores): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(LighthouseScoresPanel);
  fixture.componentRef.setInput('scores', scores);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const scores = () => lighthouseQualityFixture().lighthouse as LighthouseScores;
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim();

describe('LighthouseScores', () => {
  it('shows the four scores out of 100 with their band in text', async () => {
    const el = await render(scores());
    const items = [...el.querySelectorAll('li')].map((li) => [
      text(li.querySelector('.name')),
      text(li.querySelector('.score')),
      text(li.querySelector('.band')),
    ]);
    expect(items).toEqual([
      ['Performance', '96', 'Good'],
      ['Accessibility', '100', 'Good'],
      ['Best practices', '75', 'Needs improvement'],
      ['SEO', '42', 'Poor'],
    ]);
  });

  it('also marks the band with a class (for the color)', async () => {
    const el = await render(scores());
    expect([...el.querySelectorAll('li')].map((li) => li.dataset['band'])).toEqual([
      'good',
      'good',
      'average',
      'poor',
    ]);
  });

  it('says which page was measured', async () => {
    const el = await render(scores());
    expect(text($(el, '.url'))).toBe('Measured on https://example.com/');
  });

  it('explains the bands', async () => {
    const el = await render(scores());
    expect(text($(el, '.legend'))).toContain('0-49 poor');
    expect(text($(el, '.legend'))).toContain('50-89 needs improvement');
    expect(text($(el, '.legend'))).toContain('90-100 good');
  });
});
