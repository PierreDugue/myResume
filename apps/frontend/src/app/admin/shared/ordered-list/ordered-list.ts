import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface OrderedItem {
  id: string;
  title: string;
  subtitle?: string | null;
  /** Edit page; defaults to the item id, relative to the current page. */
  link?: string;
}

/** An ordered admin list with move up/down and delete (with confirmation). */
@Component({
  selector: 'app-ordered-list',
  imports: [RouterLink],
  templateUrl: './ordered-list.html',
  styleUrl: './ordered-list.scss',
})
export class OrderedList {
  readonly items = input.required<OrderedItem[]>();
  readonly label = input.required<string>();
  readonly reordered = output<string[]>();
  readonly deleted = output<string>();

  protected move(index: number, delta: -1 | 1): void {
    const ids = this.items().map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.reordered.emit(ids);
  }

  protected remove(item: OrderedItem): void {
    if (window.confirm(`Delete "${item.title}"?`)) this.deleted.emit(item.id);
  }
}
