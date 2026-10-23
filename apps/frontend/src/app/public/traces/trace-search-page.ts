import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TracesApi } from '../../core/traces/traces-api.service';
import { formatDate, formatDuration } from './trace-format';

/** "Trace search": every project that is a trace, in a table. */
@Component({
  selector: 'app-trace-search-page',
  imports: [RouterLink],
  templateUrl: './trace-search-page.html',
  styleUrl: './trace-search-page.scss',
})
export class TraceSearchPage {
  private readonly api = inject(TracesApi);
  protected readonly traces = rxResource({ stream: () => this.api.list() });
  protected readonly formatDate = formatDate;
  protected readonly formatDuration = formatDuration;
}
