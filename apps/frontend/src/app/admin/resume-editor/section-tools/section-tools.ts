import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FieldTree, FormField, form } from '@angular/forms/signals';
import { Observable } from 'rxjs';
import type { ResumeSectionKind } from '../../../public/plain-resume/resume-edit-slots';
import { showError } from '../../shared/form-utils';
import { ITEM_MODELS, ItemModel, ModelOf } from '../item-models';
import { ResumeEditorStore } from '../resume-editor.store';
import { SaveStatus } from '../save-status';

interface AddField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea';
}

/** What a new item needs: the required fields of its section screen's model. */
const ADD: Record<ResumeSectionKind, { label: string; fields: AddField[] }> = {
  experience: {
    label: 'Add experience',
    fields: [
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'startDate', label: 'Start date', type: 'date' },
    ],
  },
  education: {
    label: 'Add education',
    fields: [
      { key: 'school', label: 'School', type: 'text' },
      { key: 'degree', label: 'Degree', type: 'text' },
      { key: 'startDate', label: 'Start date', type: 'date' },
    ],
  },
  project: {
    label: 'Add project',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  skill: {
    label: 'Add skill',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
    ],
  },
};

interface AddSession {
  form: FieldTree<unknown>;
  fields: (AddField & { field: FieldTree<string> })[];
  create(): Observable<unknown>;
}

function openAdd<K extends ResumeSectionKind>(
  store: ResumeEditorStore,
  kind: K,
  injector: Injector,
): AddSession {
  const models = ITEM_MODELS[kind] as ItemModel<K>;
  const model = signal<ModelOf[K]>(models.empty);
  const tree = form(model, models.schema, { injector });
  const byKey = tree as unknown as Record<string, FieldTree<string>>;
  return {
    form: tree as FieldTree<unknown>,
    fields: ADD[kind].fields.map((f) => ({ ...f, field: byKey[f.key] })),
    create: () => store.create(kind, models.toRequest(model())),
  };
}

let nextId = 0;

/** The end of a section of the plain view (the `section` slot): add an item at its end. */
@Component({
  selector: 'app-section-tools',
  imports: [FormField],
  templateUrl: './section-tools.html',
  styleUrl: './section-tools.scss',
})
export class SectionTools {
  readonly section = input.required<ResumeSectionKind>();

  private readonly store = inject(ResumeEditorStore);
  private readonly injector = inject(Injector);
  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('add');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly uid = `add-${nextId++}`;
  protected readonly label = computed(() => ADD[this.section()].label);
  /** Existing categories, offered while typing a new skill's category. */
  protected readonly categories = computed(() => [
    ...new Set(this.store.list('skill').map((s) => s.category)),
  ]);
  protected readonly session = signal<AddSession | null>(null);
  protected readonly status = new SaveStatus(inject(DestroyRef));
  protected readonly showError = showError;

  protected open(): void {
    this.status.reset();
    this.session.set(openAdd(this.store, this.section(), this.injector));
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('input, textarea')?.focus(),
      { injector: this.injector },
    );
  }

  protected close(): void {
    this.session.set(null);
    afterNextRender(() => this.addButton()?.nativeElement.focus(), { injector: this.injector });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const s = this.session();
    if (!s) return;
    s.form().markAsTouched();
    if (s.form().invalid()) return;
    this.status.run(s.create(), () => this.close());
  }
}
