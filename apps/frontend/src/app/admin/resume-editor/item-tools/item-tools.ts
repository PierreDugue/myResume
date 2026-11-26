import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  ResumeItemRef,
  ResumeSectionKind,
} from '../../../public/plain-resume/resume-edit-slots';
import { DatesForm, DatedKind } from '../dates-form/dates-form';
import { ITEM_MODELS, ItemModel } from '../item-models';
import { ProfileLinksForm } from '../links-form/links-form';
import { ResumeEditorStore } from '../resume-editor.store';
import { SaveStatus } from '../save-status';
import { ItemSkillsForm } from '../skills-form/skills-form';

type SmallForm = 'dates' | 'stack' | 'links';

interface Tools {
  title: string;
  fullForm: string;
  /** Set for list items (not the profile). */
  item: { kind: ResumeSectionKind; id: string } | null;
  dates: DatedKind | null;
  stack: 'experience' | 'project' | null;
  links: boolean;
}

function toolsFor(item: ResumeItemRef, store: ResumeEditorStore): Tools | null {
  if (item.kind === 'profile') {
    const hasProfile = !!store.resume()?.profile;
    return {
      title: 'Profile',
      fullForm: '/admin/profile',
      item: null,
      dates: null,
      stack: null,
      links: hasProfile,
    };
  }
  const { kind, id } = item;
  const entity = store.find(kind, id);
  if (!entity) return null;
  // One kind at a time; TypeScript can't correlate the union of ITEM_MODELS with `entity`.
  const models = ITEM_MODELS[kind] as ItemModel<ResumeSectionKind>;
  return {
    title: models.title(entity),
    fullForm: `${models.path}/${id}`,
    item,
    dates: kind === 'skill' ? null : kind,
    stack: kind === 'experience' || kind === 'project' ? kind : null,
    links: false,
  };
}

/**
 * The tools next to an item of the plain view (the `item` slot): move, delete, its full form in
 * the section screens, and small forms for what isn't plain text (dates, tech stack, links).
 */
@Component({
  selector: 'app-item-tools',
  imports: [RouterLink, DatesForm, ItemSkillsForm, ProfileLinksForm],
  templateUrl: './item-tools.html',
  styleUrl: './item-tools.scss',
})
export class ItemTools {
  readonly item = input.required<ResumeItemRef>();

  private readonly store = inject(ResumeEditorStore);
  protected readonly tools = computed(() => toolsFor(this.item(), this.store));
  protected readonly open = signal<SmallForm | null>(null);
  protected readonly status = new SaveStatus(inject(DestroyRef));

  protected canMove(delta: -1 | 1): boolean {
    const item = this.tools()?.item;
    return !!item && this.store.canMove(item.kind, item.id, delta);
  }

  protected move(delta: -1 | 1): void {
    const item = this.tools()?.item;
    if (item) this.status.run(this.store.move(item.kind, item.id, delta));
  }

  protected remove(): void {
    const tools = this.tools();
    if (!tools?.item || !window.confirm(`Delete "${tools.title}"?`)) return;
    this.status.run(this.store.remove(tools.item.kind, tools.item.id));
  }

  protected toggle(form: SmallForm): void {
    this.open.update((open) => (open === form ? null : form));
  }
}
