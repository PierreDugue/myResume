import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import type { RefreshMode } from '../refresh-mode';
import { RefreshPicker } from './refresh-picker';

@Component({
  imports: [RefreshPicker],
  template: `<app-refresh-picker [(mode)]="mode" />`,
})
class Host {
  mode = signal<RefreshMode>('live');
}

describe('RefreshPicker', () => {
  async function render(mode: RefreshMode = 'live') {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.mode.set(mode);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('button')];
    return { fixture, el, buttons, host: fixture.componentInstance };
  }

  it('offers Off, 5s, 30s, 1m and Live, in a labelled group', async () => {
    const { el, buttons } = await render();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Off', '5s', '30s', '1m', 'Live']);
    const group = $(el, '[role="group"]');
    expect(group.getAttribute('aria-label')).toBe('Refresh');
    expect(buttons().every((b) => b.type === 'button')).toBe(true);
  });

  it.each(['off', '5s', '30s', '1m', 'live'] as const)(
    'marks only the current mode as pressed (%s)',
    async (mode) => {
      const { buttons } = await render(mode);
      const pressed = buttons().filter((b) => b.getAttribute('aria-pressed') === 'true');
      expect(pressed).toHaveLength(1);
      expect(pressed[0].textContent?.trim().toLowerCase()).toBe(mode);
      expect(buttons().filter((b) => b.getAttribute('aria-pressed') === 'false')).toHaveLength(4);
    },
  );

  it('changes the mode when a button is clicked, and shows it pressed', async () => {
    const { fixture, buttons, host } = await render('live');
    buttons()[2].click();
    await fixture.whenStable();
    expect(host.mode()).toBe('30s');
    expect(buttons()[2].getAttribute('aria-pressed')).toBe('true');
    expect(buttons()[4].getAttribute('aria-pressed')).toBe('false');
  });

  it('follows the mode when the parent changes it (e.g. from the URL)', async () => {
    const { fixture, buttons, host } = await render('live');
    host.mode.set('off');
    await fixture.whenStable();
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
  });
});
