import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import { Panel } from './panel';

@Component({
  imports: [Panel],
  template: `
    <app-panel
      title="Skills over time"
      info="Months of use per year."
      [data]="data"
      [canShowTable]="true"
      [(showTable)]="table"
    >
      <p class="content">chart</p>
    </app-panel>
  `,
})
class Host {
  data = { years: [2024, 2025] };
  table = signal(false);
}

describe('Panel', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const openMenu = async () => {
      $<HTMLButtonElement>(el, 'button.panel-menu-toggle').click();
      await fixture.whenStable();
    };
    const choose = async (label: string) => {
      await openMenu();
      const item = [...el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
        (b) => b.textContent?.trim() === label,
      );
      if (!item) throw new Error(`No menu item "${label}"`);
      item.click();
      await fixture.whenStable();
    };
    return { fixture, el, openMenu, choose };
  }

  it('shows the title as a heading, the info text and the projected content', async () => {
    const { el } = await render();
    expect($(el, 'h2').textContent?.trim()).toBe('Skills over time');
    expect($(el, '.info').getAttribute('aria-label')).toBe('Months of use per year.');
    expect($(el, '.content').textContent).toBe('chart');
  });

  it('has an accessible menu button', async () => {
    const { el, openMenu } = await render();
    const toggle = $<HTMLButtonElement>(el, 'button.panel-menu-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Skills over time menu');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await openMenu();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect([...el.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent?.trim())).toEqual(
      ['View', 'Inspect data', 'Show as table'],
    );
  });

  it('"Inspect data" shows the raw JSON in a dialog that closes with Escape', async () => {
    const { el, fixture, choose } = await render();
    await choose('Inspect data');
    const dialog = $(el, '[role="dialog"]');
    expect(dialog.getAttribute('aria-label')).toBe('Skills over time data');
    expect(JSON.parse($(dialog, 'pre').textContent ?? '')).toEqual({ years: [2024, 2025] });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('"View" shows the panel full screen until Escape', async () => {
    const { el, fixture, choose } = await render();
    await choose('View');
    expect($(el, 'section.panel').classList).toContain('fullscreen');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect($(el, 'section.panel').classList).not.toContain('fullscreen');
  });

  it('"Show as table" switches the two-way showTable flag', async () => {
    const { fixture, choose, el, openMenu } = await render();
    await choose('Show as table');
    expect(fixture.componentInstance.table()).toBe(true);
    await openMenu();
    expect(
      [...el.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent?.trim()),
    ).toContain('Show chart');
  });
});
