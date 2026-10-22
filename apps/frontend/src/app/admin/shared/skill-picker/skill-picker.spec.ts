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
  template: `<app-skill-picker [skills]="skills" [(selected)]="selected" />`,
})
class Host {
  skills = [
    skill('1', 'Angular', 'Core'),
    skill('2', 'NgRx', 'State'),
    skill('3', 'React', 'Core'),
  ];
  selected = signal<string[]>(['2']);
}

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
});
