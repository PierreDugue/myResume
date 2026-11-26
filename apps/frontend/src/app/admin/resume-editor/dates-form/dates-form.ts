import {
  Component,
  DestroyRef,
  Injector,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FieldTree, FormField, form } from '@angular/forms/signals';
import { Observable } from 'rxjs';
import { showError } from '../../shared/form-utils';
import { ITEM_MODELS } from '../item-models';
import { ResumeEditorStore, UpdateOf } from '../resume-editor.store';
import { SaveStatus } from '../save-status';

export type DatedKind = 'experience' | 'education' | 'project';

interface DatesSession {
  fields: { key: 'start' | 'end'; label: string; field: FieldTree<string> }[];
  save(): Observable<unknown>;
}

/** The dates in the item's shared model, checked with its section screen's rules. */
function openDates<K extends DatedKind>(
  store: ResumeEditorStore,
  kind: K,
  id: string,
  injector: Injector,
): DatesSession | null {
  const models = ITEM_MODELS[kind];
  const entity = store.find(kind, id);
  if (!entity) return null;
  const model = signal(models.toModel(entity));
  const tree = form(model, models.schema, { injector }) as unknown as Record<
    'startDate' | 'endDate',
    FieldTree<string>
  >;
  return {
    fields: [
      { key: 'start', label: 'Start date', field: tree.startDate },
      { key: 'end', label: 'End date', field: tree.endDate },
    ],
    save: () => {
      // The dates as typed now; the rest of the item as saved when the write's turn comes.
      const { startDate, endDate } = model();
      return store.update(kind, id, (current) => {
        const request = models.toRequest(
          { ...models.toModel(current), startDate, endDate },
          current,
        );
        return { startDate: request.startDate, endDate: request.endDate } as UpdateOf[K];
      });
    },
  };
}

let nextId = 0;

/** "Edit dates" next to an experience, education or project: start and end (empty = current). */
@Component({
  selector: 'app-dates-form',
  imports: [FormField],
  templateUrl: './dates-form.html',
})
export class DatesForm implements OnInit {
  readonly kind = input.required<DatedKind>();
  readonly id = input.required<string>();
  readonly closed = output<void>();

  private readonly store = inject(ResumeEditorStore);
  private readonly injector = inject(Injector);
  protected readonly uid = `dates-${nextId++}`;
  protected readonly session = signal<DatesSession | null>(null);
  protected readonly status = new SaveStatus(inject(DestroyRef));
  protected readonly showError = showError;

  ngOnInit(): void {
    this.session.set(openDates(this.store, this.kind(), this.id(), this.injector));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const s = this.session();
    if (!s) return;
    for (const { field } of s.fields) field().markAsTouched();
    if (s.fields.some(({ field }) => field().invalid())) return;
    this.status.run(s.save(), () => this.closed.emit());
  }
}
