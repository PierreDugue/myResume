import { readChartPalette } from './chart-palette';

describe('readChartPalette', () => {
  it('reads the series and text colors from the CSS tokens', () => {
    const el = document.createElement('div');
    el.style.setProperty('--series-1', '#111111');
    el.style.setProperty('--series-2', '#222222');
    el.style.setProperty('--color-text', '#eeeeee');
    document.body.append(el);

    const palette = readChartPalette(el);
    expect(palette.series.slice(0, 2)).toEqual(['#111111', '#222222']);
    expect(palette.text).toBe('#eeeeee');
    el.remove();
  });

  it('falls back to defaults when a token is missing', () => {
    const el = document.createElement('div');
    document.body.append(el);
    const palette = readChartPalette(el);
    expect(palette.series).toHaveLength(6);
    expect(palette.series.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
    expect(palette.muted).toMatch(/^#/);
    el.remove();
  });
});
