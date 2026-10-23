import { TestBed } from '@angular/core/testing';
import { $ } from '../../../../testing';
import { dashboardFixture } from '../../testing/dashboard-fixture';
import { CareerTimeline } from './career-timeline';

describe('CareerTimeline', () => {
  async function render(range = { from: 2011, to: 2026 }) {
    const fixture = TestBed.createComponent(CareerTimeline);
    fixture.componentRef.setInput('items', dashboardFixture().timeline);
    fixture.componentRef.setInput('range', range);
    fixture.componentRef.setInput('today', '2026-10-22');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const bar = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll<HTMLElement>('li.item')].find((li) =>
      li.textContent?.includes(label),
    ) as HTMLElement;

  it('shows jobs and education on separate rows', async () => {
    const el = await render();
    expect([...el.querySelectorAll('.lane h3')].map((h) => h.textContent?.trim())).toEqual([
      'Jobs',
      'Education',
    ]);
    expect(
      [...el.querySelectorAll('.lane:first-of-type li.item')].map((li) =>
        $(li, '.label').textContent?.trim(),
      ),
    ).toEqual(['Capgemini', 'KX', 'Whoz']);
  });

  it('places each bar on the year axis', async () => {
    const el = await render();
    // 2011–2026 = 192 months. KX: Sep 2022 (month 140) to Nov 2025 (39 months).
    const kx = bar(el, 'KX');
    expect(parseFloat(kx.style.left)).toBeCloseTo((140 / 192) * 100, 1);
    expect(parseFloat(kx.style.width)).toBeCloseTo((39 / 192) * 100, 1);
  });

  it('runs a current job until today and says so', async () => {
    const el = await render();
    const whoz = bar(el, 'Whoz');
    expect(parseFloat(whoz.style.width)).toBeCloseTo((6 / 192) * 100, 1);
    expect(whoz.textContent).toContain('May 2026 – Present');
  });

  it('clips items to the selected range', async () => {
    const el = await render({ from: 2011, to: 2011 });
    const esil = bar(el, 'ESIL');
    expect(parseFloat(esil.style.left)).toBe(0);
    expect(parseFloat(esil.style.width)).toBeCloseTo((6 / 12) * 100, 1); // Jan–Jun 2011
  });

  it('labels the year axis and never marks gaps between jobs', async () => {
    const el = await render({ from: 2022, to: 2026 });
    expect([...el.querySelectorAll('.axis .tick')].map((t) => t.textContent?.trim())).toEqual([
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
    ]);
    expect(el.querySelector('[class*="gap"]')).toBeNull();
    expect(el.textContent).not.toMatch(/gap|no data/i);
  });
});
