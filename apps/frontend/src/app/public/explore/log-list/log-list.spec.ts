import { TestBed } from '@angular/core/testing';
import type { LogEntry } from '@my-resume/api-models';
import { $ } from '../../../testing';
import { logsFixture } from '../testing/logs-fixture';
import { LogList } from './log-list';

describe('LogList', () => {
  async function render(entries: LogEntry[] = logsFixture().entries) {
    const fixture = TestBed.createComponent(LogList);
    fixture.componentRef.setInput('entries', entries);
    const filter = vi.fn();
    fixture.componentInstance.filter.subscribe(filter);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { el, filter, stable: () => fixture.whenStable() };
  }
  const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim();

  it('prints each entry as a log line', async () => {
    const { el } = await render();
    expect([...el.querySelectorAll('li.line .summary')].map(text)).toEqual([
      '2026-10-22 ACHIEVEMENT [Whoz] Generate 95% of code with Claude.',
      '2025-11-30 MILESTONE [KX] Introduced NX.',
      '2024-06-30 MILESTONE [ESIL] Graduated: Engineering degree',
    ]);
    expect($(el, 'li.line .level').className).toContain('achievement');
  });

  it('expands a line to show its labels and technologies', async () => {
    const { el, stable } = await render();
    const toggle = $<HTMLButtonElement>(el, 'li.line:nth-child(2) button.summary');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('li.line:nth-child(2) .details')).toBeNull();

    toggle.click();
    await stable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const rows = [...el.querySelectorAll('li.line:nth-child(2) .details tr')].map(
      (tr) => text(tr.querySelector('th')) + '=' + text(tr.querySelector('td')),
    );
    expect(rows).toEqual([
      'type=experience',
      'level=milestone',
      'company=KX',
      'role=Front-End Engineer',
      'team=platform',
      'tech=Angular, NX',
    ]);

    toggle.click();
    await stable();
    expect(el.querySelector('li.line:nth-child(2) .details')).toBeNull();
  });

  it('filters for or out a label value', async () => {
    const { el, filter, stable } = await render();
    $<HTMLButtonElement>(el, 'li.line:nth-child(2) button.summary').click();
    await stable();
    $<HTMLButtonElement>(el, 'button[aria-label="Filter for company=KX"]').click();
    expect(filter).toHaveBeenLastCalledWith({ label: 'company', value: 'KX', op: '=' });
    $<HTMLButtonElement>(el, 'button[aria-label="Filter out team=platform"]').click();
    expect(filter).toHaveBeenLastCalledWith({ label: 'team', value: 'platform', op: '!=' });
    $<HTMLButtonElement>(el, 'button[aria-label="Filter for tech=NX"]').click();
    expect(filter).toHaveBeenLastCalledWith({ label: 'tech', value: 'NX', op: '=' });
  });

  it('shows an empty state', async () => {
    const { el } = await render([]);
    expect(el.textContent).toContain('No log lines match this query');
  });
});
