import { Component, computed, input } from '@angular/core';
import type { FeedStatus } from '../feed-status';

const LABELS: Record<FeedStatus, string> = {
  live: 'LIVE',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'Offline · polling every 5s',
  fallback: 'Live unavailable · polling every 5s',
  'poll-5s': 'Polling every 5s',
  'poll-30s': 'Polling every 30s',
  'poll-1m': 'Polling every 1m',
  paused: 'Paused (tab hidden)',
  off: 'Off',
};

/**
 * Where the data comes from right now. The state is written in words; the dot is only
 * decoration (and pulses only while live, unless the visitor asks for reduced motion).
 */
@Component({
  selector: 'app-live-badge',
  templateUrl: './live-badge.html',
  styleUrl: './live-badge.scss',
})
export class LiveBadge {
  readonly status = input.required<FeedStatus>();

  protected readonly label = computed(() => LABELS[this.status()]);
}
