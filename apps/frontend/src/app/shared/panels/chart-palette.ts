/** Chart colors, read from the CSS tokens of the current theme (styles.scss). */
export interface ChartPalette {
  series: string[];
  text: string;
  muted: string;
  border: string;
  surface: string;
  accent: string;
}

const DEFAULTS: ChartPalette = {
  series: ['#6cb8ff', '#ff8a3d', '#3ccf91', '#c58af9', '#f2c94c', '#ff6fae'],
  text: '#dde3ee',
  muted: '#8c95a8',
  border: '#262d3a',
  surface: '#11151d',
  accent: '#ff8a3d',
};

export function readChartPalette(element: Element): ChartPalette {
  const computed = getComputedStyle(element);
  const inline = (element as HTMLElement).style;
  const token = (name: string, fallback: string) =>
    computed.getPropertyValue(name).trim() || inline?.getPropertyValue(name).trim() || fallback;
  return {
    series: DEFAULTS.series.map((fallback, i) => token(`--series-${i + 1}`, fallback)),
    text: token('--color-text', DEFAULTS.text),
    muted: token('--color-text-muted', DEFAULTS.muted),
    border: token('--color-border', DEFAULTS.border),
    surface: token('--color-surface-2', DEFAULTS.surface),
    accent: token('--color-accent', DEFAULTS.accent),
  };
}
