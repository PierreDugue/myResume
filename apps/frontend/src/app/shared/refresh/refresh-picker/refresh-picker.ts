import { Component, model } from '@angular/core';
import { REFRESH_MODES, type RefreshMode } from '../refresh-mode';

const LABELS: Record<RefreshMode, string> = {
  off: 'Off',
  '5s': '5s',
  '30s': '30s',
  '1m': '1m',
  live: 'Live',
};

/** How the dashboard refreshes: a segmented control of toggle buttons, Off / 5s / 30s / 1m / Live. */
@Component({
  selector: 'app-refresh-picker',
  templateUrl: './refresh-picker.html',
  styleUrl: './refresh-picker.scss',
})
export class RefreshPicker {
  readonly mode = model<RefreshMode>('live');

  protected readonly options = REFRESH_MODES.map((mode) => ({ mode, label: LABELS[mode] }));
}
