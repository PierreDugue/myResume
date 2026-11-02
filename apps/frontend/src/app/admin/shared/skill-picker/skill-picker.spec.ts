import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Skill } from '@my-resume/api-models';
import { SkillPicker } from './skill-picker';

const skill = (id: string, name: string, category: string): Skill => ({
  id,
  name,
  slug: id,
  category,
  level: null,
  sortOrder: 0,
});

@Component({
  imports: [SkillPicker],
  template: `<app-skill-picker [skills]="skills" [(selected)]="selected" [max]="max()" />`,
})
class Host {
  max = signal<number | null>(null);
  skills = [
    skill('1', 'Angular', 'Core'),
    skill('2', 'NgRx', 'State'),
    skill('3', 'React', 'Core'),
  ];
  selected = signal<string[]>(['2']);
}

/**
 * A box the limit blocks: announced as disabled (`aria-disabled`) but never `disabled`, so it stays
 * in the tab order and a keyboard user can still reach it.
 */
const blocked = (box: HTMLInputElement): boolean => {
  expect(box.disabled).toBe(false);
  return box.getAttribute('aria-disabled') === 'true';
};

describe('SkillPicker', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('groups the skills by category, in a fieldset per group', async () => {
    const { el } = await render();
    const legends = [...el.querySelectorAll('fieldset legend')].map((l) => l.textContent?.trim());
    expect(legends).toEqual(['Core', 'State']);
    expect(el.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
  });

  it('checks the selected skills and updates the selection when toggled', async () => {
    const { el, fixture } = await render();
    const boxes = [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const byLabel = (name: string) =>
      boxes.find((b) => b.closest('label')?.textContent?.includes(name)) as HTMLInputElement;

    expect(byLabel('NgRx').checked).toBe(true);
    expect(byLabel('Angular').checked).toBe(false);

    byLabel('Angular').click();
    expect(fixture.componentInstance.selected()).toEqual(['2', '1']);
    byLabel('NgRx').click();
    expect(fixture.componentInstance.selected()).toEqual(['1']);
  });

  describe('max', () => {
    const boxesOf = (el: HTMLElement): Record<string, HTMLInputElement> =>
      Object.fromEntries(
        [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map((b) => [
          b.closest('label')?.textContent?.trim(),
          b,
        ]),
      );

    it('has no limit by default: no box is blocked', async () => {
      const { el, fixture } = await render();
      fixture.componentInstance.selected.set(['1', '2', '3']);
      await fixture.whenStable();
      expect(Object.values(boxesOf(el)).every((b) => !blocked(b))).toBe(true);
    });

    it('blocks the unchecked boxes once the limit is reached, and keeps the checked ones free', async () => {
      const { el, fixture } = await render();
      fixture.componentInstance.max.set(2);
      await fixture.whenStable();
      let boxes = boxesOf(el);
      expect(blocked(boxes['Angular'])).toBe(false); // 1 of 2 selected

      boxes['Angular'].click();
      await fixture.whenStable();
      boxes = boxesOf(el);
      expect(fixture.componentInstance.selected()).toEqual(['2', '1']);
      expect(blocked(boxes['React'])).toBe(true);
      expect(blocked(boxes['Angular'])).toBe(false);
      expect(blocked(boxes['NgRx'])).toBe(false);
    });

    it('unblocks the boxes again when one is unchecked', async () => {
      const { el, fixture } = await render();
      fixture.componentInstance.max.set(2);
      fixture.componentInstance.selected.set(['1', '2']);
      await fixture.whenStable();
      expect(blocked(boxesOf(el)['React'])).toBe(true);

      boxesOf(el)['NgRx'].click();
      await fixture.whenStable();
      expect(fixture.componentInstance.selected()).toEqual(['1']);
      expect(blocked(boxesOf(el)['React'])).toBe(false);
    });

    it('ignores a click on a blocked box: it stays unchecked and the selection is unchanged', async () => {
      const { el, fixture } = await render();
      fixture.componentInstance.max.set(1);
      await fixture.whenStable();

      boxesOf(el)['React'].click();
      await fixture.whenStable();
      expect(boxesOf(el)['React'].checked).toBe(false);
      expect(fixture.componentInstance.selected()).toEqual(['2']);
    });

    it('keeps a blocked box focusable', async () => {
      const { el, fixture } = await render();
      fixture.componentInstance.max.set(1);
      await fixture.whenStable();
      document.body.appendChild(el);
      try {
        boxesOf(el)['React'].focus();
        expect(document.activeElement).toBe(boxesOf(el)['React']);
      } finally {
        el.remove();
      }
    });

    it('blocks the unchecked boxes when max is 1 and one is selected', async () => {
      const { el, fixture } = await render();
      fixture.componentInstance.max.set(1);
      await fixture.whenStable();
      const boxes = boxesOf(el);
      expect(blocked(boxes['NgRx'])).toBe(false);
      expect(blocked(boxes['Angular'])).toBe(true);
      expect(blocked(boxes['React'])).toBe(true);
    });
  });
});
