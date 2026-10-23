import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { TraceSpan } from '@my-resume/api-models';
import { $ } from '../../../testing';
import { traceFixture } from '../testing/traces-fixture';
import { Waterfall } from './waterfall';

describe('Waterfall', () => {
  async function render(spans: TraceSpan[] = traceFixture().spans) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Waterfall);
    fixture.componentRef.setInput('spans', spans);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, stable: () => fixture.whenStable() };
  }
  const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('li.row')];
  const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim();

  it('draws one row per span, indented by depth, with its duration', () => {
    return render().then(({ el }) => {
      expect(
        rows(el).map((r) => [text(r.querySelector('.name')), r.getAttribute('aria-level')]),
      ).toEqual([
        ['Pierre O11y ongoing', '1'],
        ['Specification', '2'],
        ['Features ongoing', '2'],
        ['Auth', '3'],
      ]);
      expect(rows(el).map((r) => text(r.querySelector('.duration')))).toEqual([
        '4 days',
        '1 day',
        '3 days',
        '1 day',
      ]);
    });
  });

  it('places each bar on the time axis', async () => {
    const { el } = await render();
    const bar = (i: number) => rows(el)[i].querySelector<HTMLElement>('.bar');
    expect(bar(0)?.style.left).toBe('0%');
    expect(bar(0)?.style.width).toBe('100%');
    expect(bar(2)?.style.left).toBe('25%');
    expect(bar(2)?.style.width).toBe('75%');
    expect(bar(2)?.classList).toContain('ongoing');
    expect([...el.querySelectorAll('.axis .tick')].map(text)).toEqual([
      'Oct 21',
      'Oct 22',
      'Oct 23',
      'Oct 24',
    ]);
  });

  it('opens a span to show its dates, note and technologies', async () => {
    const { el, stable } = await render();
    const toggle = $<HTMLButtonElement>(rows(el)[2], 'button.summary');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await stable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const details = $(rows(el)[2], '.details');
    expect(text(details)).toContain('Oct 22, 2026 → Oct 24, 2026 (ongoing)');
    const links = [...details.querySelectorAll('a')].map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Angular', '/?skill=angular'],
      ['NestJS', '/?skill=nestjs'],
    ]);

    $<HTMLButtonElement>(rows(el)[1], 'button.summary').click();
    await stable();
    expect(text($(rows(el)[1], '.details'))).toContain('The spec.');
  });
});
