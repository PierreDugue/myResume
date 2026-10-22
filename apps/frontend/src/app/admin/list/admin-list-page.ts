import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ContentApi, CrudApi, apiErrorMessage } from '../../core/content/content-api.service';
import { OrderedItem, OrderedList } from '../shared/ordered-list/ordered-list';

/** Route data (`data: { list }`) describing one admin list. */
export interface ListConfig<T> {
  resource: 'skills' | 'experiences' | 'education' | 'projects';
  label: string;
  addLabel: string;
  toItem: (item: T) => OrderedItem;
}

/** One page for every content list: order, delete, links to the edit pages. */
@Component({
  selector: 'app-admin-list-page',
  imports: [OrderedList, RouterLink],
  template: `
    <div class="toolbar">
      <a class="button primary add" routerLink="new">{{ config.addLabel }}</a>
    </div>
    @if (error(); as message) {
      <p class="form-error" role="alert">{{ message }}</p>
    }
    @if (items.hasValue()) {
      <app-ordered-list
        [items]="rows()"
        [label]="config.label"
        (reordered)="reorder($event)"
        (deleted)="remove($event)"
      />
    } @else if (items.isLoading()) {
      <p class="muted">Loading…</p>
    }
  `,
  styles: `
    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: var(--space-3);
    }
    .form-error {
      margin-bottom: var(--space-3);
    }
    .muted {
      color: var(--color-text-muted);
    }
  `,
})
export class AdminListPage {
  protected readonly config = inject(ActivatedRoute).snapshot.data['list'] as ListConfig<unknown>;
  private readonly api = inject(ContentApi)[this.config.resource] as CrudApi<
    unknown,
    unknown,
    unknown
  >;

  protected readonly error = signal<string | null>(null);
  protected readonly items = rxResource({ stream: () => this.api.list() });
  protected readonly rows = computed(() =>
    (this.items.hasValue() ? this.items.value() : []).map(this.config.toItem),
  );

  protected reorder(ids: string[]): void {
    this.run(this.api.reorder(ids));
  }

  protected remove(id: string): void {
    this.run(this.api.remove(id));
  }

  private run(action: Observable<void>): void {
    this.error.set(null);
    action.subscribe({
      next: () => this.items.reload(),
      error: (e: unknown) => this.error.set(apiErrorMessage(e)),
    });
  }
}
