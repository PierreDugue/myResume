import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('lists "Code quality" before "About this site"', () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(NAV_ITEMS.find((i) => i.label === 'Code quality')?.path).toBe('/dashboards/quality');
    expect(labels.indexOf('Code quality')).toBeGreaterThan(-1);
    expect(labels.indexOf('Code quality')).toBe(labels.indexOf('About this site') - 1);
  });
});
