import {
  STREAM_LOG_MAX,
  appendEntry,
  formatClientTime,
  previewJson,
  streamEntry,
  summariseHistory,
  summariseSamples,
} from './stream-log';
import { historyOf, sampleAt, samplesBetween, tsAt } from './testing/process-fixture';

describe('formatClientTime', () => {
  it('pads to HH:MM:SS.mmm in the client time zone', () => {
    expect(formatClientTime(new Date(2026, 10, 5, 4, 2, 9, 7))).toBe('04:02:09.007');
    expect(formatClientTime(new Date(2026, 10, 5, 23, 59, 59, 999))).toBe('23:59:59.999');
  });
});

describe('previewJson', () => {
  it('writes compact JSON', () => {
    expect(previewJson({ since: '2026-11-05T14:00:00.000Z' })).toBe(
      '{"since":"2026-11-05T14:00:00.000Z"}',
    );
    expect(previewJson({})).toBe('{}');
  });

  it('cuts a long payload at 160 characters and says so with an ellipsis', () => {
    const preview = previewJson({ text: 'x'.repeat(500) });
    expect(preview).toHaveLength(160);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.startsWith('{"text":"xxx')).toBe(true);
  });

  it('keeps a payload of exactly 160 characters whole', () => {
    const value = 'y'.repeat(160 - 2); // two quotes around it make 160 characters
    expect(previewJson(value)).toBe(`"${value}"`);
  });

  it('cuts at the limit it is given', () => {
    expect(previewJson('abcdefghij', 6)).toBe('"abcd…');
  });

  it('shows a raw tick, which is longer than the limit, truncated', () => {
    const preview = previewJson(sampleAt(0));
    expect(preview.startsWith('{"ts":"2026-11-05T14:00:00.000Z","uptimeSeconds":3600')).toBe(true);
    expect(preview).toHaveLength(160);
  });

  it('writes undefined as nothing', () => {
    expect(previewJson(undefined)).toBe('');
  });
});

describe('summariseSamples / summariseHistory', () => {
  it('gives the count and the time span (UTC) of the samples', () => {
    const samples = samplesBetween(0, 299); // 14:00:00 -> 14:04:59
    expect(summariseSamples(samples)).toBe('300 samples, 14:00:00 → 14:04:59');
    expect(summariseHistory(historyOf(samples))).toBe('history: 300 samples, 14:00:00 → 14:04:59');
  });

  it('uses the singular for one sample, with no range', () => {
    expect(summariseSamples([sampleAt(7)])).toBe('1 sample, 14:00:07');
  });

  it('says so when there is nothing new', () => {
    expect(summariseSamples([])).toBe('0 samples');
    expect(summariseHistory(historyOf([]))).toBe('history: 0 samples');
  });

  it('reads the time of the ts string, whatever the browser time zone', () => {
    expect(summariseSamples([{ ...sampleAt(0), ts: '2026-11-05T23:59:58.500Z' }])).toBe(
      '1 sample, 23:59:58',
    );
    expect(tsAt(0)).toBe('2026-11-05T14:00:00.000Z');
  });
});

describe('streamEntry', () => {
  const now = new Date(2026, 10, 5, 14, 2, 11, 123);

  it.each([
    ['sent', '↑'],
    ['received', '↓'],
    ['lifecycle', '•'],
    ['http', 'HTTP'],
  ] as const)('marks a %s entry with "%s"', (direction, symbol) => {
    expect(streamEntry(now, direction, 'x', '{}')).toEqual({
      time: '14:02:11.123',
      direction,
      symbol,
      event: 'x',
      preview: '{}',
    });
  });
});

describe('appendEntry', () => {
  const entry = (n: number) => streamEntry(new Date(2026, 0, 1, 0, 0, n), 'received', `e${n}`, '');
  const events = (log: { event: string }[]) => log.map((e) => e.event);

  it('puts the newest entry first', () => {
    expect(events(appendEntry([entry(1)], entry(2)))).toEqual(['e2', 'e1']);
  });

  it('keeps 8 entries by default', () => {
    expect(STREAM_LOG_MAX).toBe(8);
    let log = [] as ReturnType<typeof entry>[];
    for (let n = 1; n <= 10; n++) log = appendEntry(log, entry(n));
    expect(events(log)).toEqual(['e10', 'e9', 'e8', 'e7', 'e6', 'e5', 'e4', 'e3']);
  });

  it('keeps as many as the caller asks for', () => {
    expect(events(appendEntry([entry(1), entry(2)], entry(3), 2))).toEqual(['e3', 'e1']);
  });

  it('does not change the log it is given', () => {
    const log = [entry(1)];
    appendEntry(log, entry(2));
    expect(events(log)).toEqual(['e1']);
  });
});
