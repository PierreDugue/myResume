import { Component, input } from '@angular/core';
import type { StreamDirection, StreamLogEntry } from '../stream-log';

const DIRECTION_NAMES: Record<StreamDirection, string> = {
  sent: 'sent',
  received: 'received',
  lifecycle: 'lifecycle',
  http: 'HTTP',
};

/**
 * The last messages of the live feed, newest first, in monospace. Not a live region on purpose:
 * it changes every second, which would flood a screen reader.
 */
@Component({
  selector: 'app-stream-inspector',
  templateUrl: './stream-inspector.html',
  styleUrl: './stream-inspector.scss',
})
export class StreamInspector {
  readonly entries = input.required<StreamLogEntry[]>();

  protected readonly directionName = (direction: StreamDirection) => DIRECTION_NAMES[direction];
}
