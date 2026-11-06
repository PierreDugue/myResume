import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import { streamEntry, type StreamLogEntry } from '../stream-log';
import { StreamInspector } from './stream-inspector';

describe('StreamInspector', () => {
  const at = (s: number) => new Date(2026, 10, 5, 14, 0, s, 5);
  const entries: StreamLogEntry[] = [
    streamEntry(at(3), 'received', 'metrics:tick', '{"ts":"2026-11-05T14:00:03.000Z"}'),
    streamEntry(at(2), 'received', 'subscribe:metrics (ack)', 'history: 3 samples'),
    streamEntry(at(1), 'sent', 'subscribe:metrics', '{}'),
    streamEntry(at(0), 'lifecycle', 'connect', ''),
    streamEntry(at(0), 'http', 'GET /api/site-metrics/process', '2 samples'),
  ];

  async function render(list: StreamLogEntry[]) {
    const fixture = TestBed.createComponent(StreamInspector);
    fixture.componentRef.setInput('entries', list);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const rows = (el: HTMLElement) =>
    [...el.querySelectorAll('li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());

  it('lists the entries in the order it is given (newest first), with time, event and payload', async () => {
    const { el } = await render(entries);
    expect(rows(el)).toEqual([
      '14:00:03.005 ↓ received metrics:tick {"ts":"2026-11-05T14:00:03.000Z"}',
      '14:00:02.005 ↓ received subscribe:metrics (ack) history: 3 samples',
      '14:00:01.005 ↑ sent subscribe:metrics {}',
      '14:00:00.005 • lifecycle connect',
      '14:00:00.005 HTTP GET /api/site-metrics/process 2 samples',
    ]);
  });

  it('names the direction in text for screen readers, not only with an arrow', async () => {
    const { el } = await render(entries);
    const directions = [...el.querySelectorAll('.direction')].map((d) =>
      d.textContent?.replace(/\s+/g, ' ').trim(),
    );
    // The HTTP label is already a word: it is not repeated for screen readers.
    expect(directions).toEqual(['↓ received', '↓ received', '↑ sent', '• lifecycle', 'HTTP']);
    expect($(el, '.direction [aria-hidden="true"]').textContent?.trim()).toBe('↓');
  });

  it('is not a live region: it changes every second and would flood a screen reader', async () => {
    const { el } = await render(entries);
    expect(el.querySelector('[aria-live], [role="status"], [role="log"]')).toBeNull();
  });

  it('says it is waiting when there is nothing yet', async () => {
    const { el } = await render([]);
    expect(el.textContent).toContain('No messages yet');
    expect(el.querySelector('li')).toBeNull();
  });

  it('shows the long payloads whole in the page (they are cut before, in the entry)', async () => {
    const long = streamEntry(at(0), 'received', 'metrics:tick', 'x'.repeat(159) + '…');
    const { el } = await render([long]);
    expect($(el, '.preview').textContent).toBe('x'.repeat(159) + '…');
  });

  it('updates when the entries change', async () => {
    const { fixture, el } = await render(entries.slice(0, 1));
    expect(rows(el)).toHaveLength(1);
    fixture.componentRef.setInput('entries', entries);
    await fixture.whenStable();
    expect(rows(el)).toHaveLength(5);
  });
});
