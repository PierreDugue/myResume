import { Component, computed, input, model, signal } from '@angular/core';

/**
 * Dashboard panel frame: title, info tooltip and a menu with View (full screen), Inspect data
 * (raw JSON) and, for charts, a table alternative. Escape closes the full screen and the dialog.
 */
@Component({
  selector: 'app-panel',
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  host: { '(document:keydown.escape)': 'closeAll()' },
})
export class Panel {
  readonly title = input.required<string>();
  readonly info = input<string | null>(null);
  /** Shown by "Inspect data". */
  readonly data = input<unknown>(null);
  /** Adds "Show as table" / "Show chart" to the menu. */
  readonly canShowTable = input(false);
  readonly showTable = model(false);

  protected readonly menuOpen = signal(false);
  protected readonly fullscreen = signal(false);
  protected readonly inspecting = signal(false);
  protected readonly json = computed(() => JSON.stringify(this.data(), null, 2));

  protected view(): void {
    this.fullscreen.update((f) => !f);
    this.menuOpen.set(false);
  }

  protected inspect(): void {
    this.inspecting.set(true);
    this.menuOpen.set(false);
  }

  protected toggleTable(): void {
    this.showTable.update((t) => !t);
    this.menuOpen.set(false);
  }

  protected closeAll(): void {
    this.menuOpen.set(false);
    this.fullscreen.set(false);
    this.inspecting.set(false);
  }
}
