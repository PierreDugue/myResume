import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { dashboardFixture } from '../../testing/dashboard-fixture';
import { LogPreview } from './log-preview';

describe('LogPreview', () => {
  async function render(lines = dashboardFixture().latestHighlights) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(LogPreview);
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('range', { from: 2017, to: 2020 });
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('prints the latest highlights as log lines', async () => {
    const el = await render();
    const lines = [...el.querySelectorAll('li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(lines).toEqual([
      '2026-10-22 ACHIEVEMENT [Whoz] Generate 95% of code with Claude.',
      '2025-11-30 MILESTONE [KX] Introduced NX.',
    ]);
    expect(el.querySelector('li .level')?.className).toContain('achievement');
  });

  it('links to Explore for the same years', async () => {
    const el = await render();
    const link = el.querySelector('a.explore');
    expect(link?.textContent).toContain('Open in Explore');
    expect(link?.getAttribute('href')).toBe('/explore?from=2017&to=2020');
  });

  it('shows an empty state', async () => {
    const el = await render([]);
    expect(el.textContent).toContain('No highlights in this range');
  });
});
