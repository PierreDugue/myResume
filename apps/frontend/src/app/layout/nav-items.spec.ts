import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('lists "Code quality" before "About this site"', () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(NAV_ITEMS.find((i) => i.label === 'Code quality')?.path).toBe('/dashboards/quality');
    expect(labels.indexOf('Code quality')).toBeGreaterThan(-1);
    expect(labels.indexOf('Code quality')).toBeLessThan(labels.indexOf('About this site'));
  });
});

describe('NAV_ITEMS site metrics', () => {
  it('lists "Site metrics" after "Code quality", on /dashboards/meta', () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(NAV_ITEMS.find((i) => i.label === 'Site metrics')?.path).toBe('/dashboards/meta');
    expect(labels.indexOf('Site metrics')).toBe(labels.indexOf('Code quality') + 1);
  });
});

describe('NAV_ITEMS pages', () => {
  it('gives every entry its own public page id', () => {
    const pages = NAV_ITEMS.map((i) => i.page);
    expect(new Set(pages).size).toBe(NAV_ITEMS.length);
    expect(pages).toEqual([
      'overview',
      'explore',
      'traces',
      'serviceMap',
      'quality',
      'siteMetrics',
      'about',
    ]);
  });
});
