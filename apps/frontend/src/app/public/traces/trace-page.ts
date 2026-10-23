import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TracesApi } from '../../core/traces/traces-api.service';
import { Panel } from '../../shared/panels/panel/panel';
import { formatDate, formatDuration } from './trace-format';
import { Waterfall } from './waterfall/waterfall';

/** One project as a trace waterfall (`/traces/:slug`). */
@Component({
  selector: 'app-trace-page',
  imports: [RouterLink, Panel, Waterfall],
  templateUrl: './trace-page.html',
  styleUrl: './trace-page.scss',
})
export class TracePage {
  private readonly api = inject(TracesApi);
  private readonly route = inject(ActivatedRoute);

  private readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('slug') ?? '',
  });
  protected readonly trace = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.api.get(params),
  });
  protected readonly notFound = computed(() => {
    const error = this.trace.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });
  protected readonly showTable = signal(false);
  protected readonly formatDate = formatDate;
  protected readonly formatDuration = formatDuration;
}
