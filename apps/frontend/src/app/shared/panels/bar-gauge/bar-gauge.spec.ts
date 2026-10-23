import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import { BarGauge, GaugeGroup } from './bar-gauge';

describe('BarGauge', () => {
  const groups: GaugeGroup[] = [
    { label: 'Core', items: [{ label: 'Angular', value: 8, display: '8 yrs', note: null }] },
    {
      label: 'State',
      items: [
        { label: 'NgRx', value: 4, display: '4 yrs', note: 'level 5/5' },
        { label: 'Redux', value: 2, display: '2 yrs', note: null },
      ],
    },
  ];

  async function render(value = groups) {
    const fixture = TestBed.createComponent(BarGauge);
    fixture.componentRef.setInput('groups', value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('groups bars under category headings', async () => {
    const el = await render();
    expect([...el.querySelectorAll('h3')].map((h) => h.textContent?.trim())).toEqual([
      'Core',
      'State',
    ]);
    expect(el.querySelectorAll('li')).toHaveLength(3);
  });

  it('sizes each bar relative to the largest value', async () => {
    const el = await render();
    const widths = [...el.querySelectorAll<HTMLElement>('.fill')].map((f) => f.style.width);
    expect(widths).toEqual(['100%', '50%', '25%']);
  });

  it('describes each bar in text (not only with its length)', async () => {
    const el = await render();
    const ngrx = el.querySelectorAll('li')[1];
    expect(ngrx.textContent).toContain('NgRx');
    expect(ngrx.textContent).toContain('4 yrs');
    expect(ngrx.textContent).toContain('level 5/5');
    expect($(ngrx, '.bar').getAttribute('aria-hidden')).toBe('true');
  });

  it('shows an empty state', async () => {
    const el = await render([]);
    expect(el.textContent).toContain('No data for this selection');
  });
});
