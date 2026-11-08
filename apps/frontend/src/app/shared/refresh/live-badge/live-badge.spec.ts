import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import type { FeedStatus } from '../feed-status';
import { LiveBadge } from './live-badge';

describe('LiveBadge', () => {
  async function render(status: FeedStatus) {
    const fixture = TestBed.createComponent(LiveBadge);
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, text: el.textContent?.replace(/\s+/g, ' ').trim() };
  }

  it.each([
    ['live', 'LIVE'],
    ['connecting', 'Connecting…'],
    ['reconnecting', 'Reconnecting…'],
    ['offline', 'Offline · polling every 5s'],
    ['fallback', 'Live unavailable · polling every 5s'],
    ['poll-5s', 'Polling every 5s'],
    ['poll-30s', 'Polling every 30s'],
    ['poll-1m', 'Polling every 1m'],
    ['paused', 'Paused (tab hidden)'],
    ['off', 'Off'],
  ] as const)('says %s in words: "%s"', async (status, words) => {
    const { text } = await render(status);
    expect(text).toBe(words);
  });

  it('is a polite status region, so a change is announced', async () => {
    const { el } = await render('live');
    expect($(el, '[role="status"]')).toBeTruthy();
  });

  it('pulses the dot only while live, and the dot is decoration (the text carries the state)', async () => {
    const live = await render('live');
    const dot = $(live.el, '.dot');
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(dot.classList.contains('pulse')).toBe(true);

    for (const status of [
      'connecting',
      'reconnecting',
      'offline',
      'poll-5s',
      'paused',
      'off',
    ] as const) {
      TestBed.resetTestingModule();
      const other = await render(status);
      expect($(other.el, '.dot').classList.contains('pulse')).toBe(false);
    }
  });

  it('marks the state on the host for styling, never as the only signal', async () => {
    const { el } = await render('offline');
    expect($(el, '[role="status"]').getAttribute('data-status')).toBe('offline');
  });
});
