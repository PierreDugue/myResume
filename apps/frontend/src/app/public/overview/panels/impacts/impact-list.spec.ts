import { TestBed } from '@angular/core/testing';
import type { Impact } from '@my-resume/api-models';
import { $ } from '../../../../testing';
import { dashboardFixture } from '../../testing/dashboard-fixture';
import { formatImpact, ImpactList } from './impact-list';

const impact = (i: Partial<Impact>): Impact => ({
  metric: 'm',
  before: null,
  after: null,
  changePct: null,
  unit: null,
  direction: 'up-is-good',
  ...i,
});

describe('formatImpact', () => {
  it.each([
    [
      impact({ changePct: -35, unit: '%', direction: 'down-is-good' }),
      { headline: '−35%', detail: null, trend: 'down', good: true },
    ],
    [
      impact({ changePct: 20, unit: '%' }),
      { headline: '+20%', detail: null, trend: 'up', good: true },
    ],
    [
      impact({ changePct: 10, unit: '%', direction: 'down-is-good' }),
      { headline: '+10%', detail: null, trend: 'up', good: false },
    ],
    [
      impact({ before: 20, after: 75, unit: '%' }),
      { headline: '75%', detail: '20% → 75%', trend: 'up', good: true },
    ],
    [
      impact({ after: 95, unit: '%' }),
      { headline: '95%', detail: null, trend: 'flat', good: true },
    ],
    [impact({ after: 100 }), { headline: '100', detail: null, trend: 'flat', good: true }],
  ])('%j', (input, expected) => {
    expect(formatImpact(input)).toEqual(expected);
  });
});

describe('ImpactList', () => {
  async function render() {
    const fixture = TestBed.createComponent(ImpactList);
    fixture.componentRef.setInput('items', dashboardFixture().impacts);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows one card per achievement with metric, value, company and year', async () => {
    const el = await render();
    const cards = [...el.querySelectorAll('li.impact')];
    expect(cards.map((c) => $(c, 'h3').textContent?.trim())).toEqual([
      'Page load time',
      'Code coverage',
    ]);
    expect($(cards[0], '.headline').textContent).toContain('−35%');
    expect(cards[0].textContent).toContain('KX · 2025');
    expect(cards[0].classList).toContain('good');
  });

  it('describes the trend in words for screen readers', async () => {
    const el = await render();
    expect($(el, 'li.impact .sr-only').textContent?.trim()).toBe('decrease, an improvement');
  });

  it('draws a before → after chart when both values are known', async () => {
    const el = await render();
    const [first, second] = [...el.querySelectorAll('li.impact')];
    expect(first.querySelector('svg.step')).toBeNull();
    expect($(second, '.detail').textContent).toContain('20% → 75%');
    expect(second.querySelector('svg.step')).not.toBeNull();
  });
});
