import { Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import type { ServiceMapNode } from '@my-resume/api-models';
import { ServiceMapApi } from '../../core/service-map/service-map-api.service';
import { ThemeService } from '../../core/theme/theme.service';
import { readChartPalette } from '../../shared/panels/chart-palette';
import { EChart } from '../../shared/panels/echart/echart';
import { Panel } from '../../shared/panels/panel/panel';
import { NODE_KINDS, nodeLink, serviceMapOption } from './service-map-option';

/**
 * Service map: technologies linked to the jobs and projects that used them. Clicking a node opens
 * the view behind it (the dashboard filtered by a technology, a project's trace, a job's logs).
 */
@Component({
  selector: 'app-service-map-page',
  imports: [Panel, EChart, RouterLink],
  templateUrl: './service-map-page.html',
  styleUrl: './service-map-page.scss',
})
export class ServiceMapPage {
  private readonly api = inject(ServiceMapApi);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  protected readonly map = rxResource({ stream: () => this.api.get() });
  protected readonly showTable = signal(false);

  private readonly palette = computed(() => {
    this.theme.theme(); // re-read the CSS tokens when the theme changes
    return readChartPalette(this.document.documentElement);
  });
  protected readonly option = computed(() =>
    this.map.hasValue() ? serviceMapOption(this.map.value(), this.palette()) : null,
  );

  /** Table rows: each node with its link and the nodes it is connected to. */
  protected readonly rows = computed(() => {
    if (!this.map.hasValue()) return [];
    const { nodes, edges } = this.map.value();
    return nodes.map((node) => {
      const neighbours = new Set(
        edges.flatMap((e) =>
          e.source === node.id ? [e.target] : e.target === node.id ? [e.source] : [],
        ),
      );
      return {
        node,
        kind: NODE_KINDS.find((k) => k.kind === node.kind)?.single ?? node.kind,
        link: nodeLink(node),
        connected: nodes
          .filter((n) => neighbours.has(n.id))
          .map((n) => n.label)
          .join(', '),
      };
    });
  });

  protected open(params: unknown): void {
    const { dataType, data } = (params ?? {}) as { dataType?: string; data?: { id?: string } };
    if (dataType !== 'node' || !this.map.hasValue()) return;
    const node: ServiceMapNode | undefined = this.map.value().nodes.find((n) => n.id === data?.id);
    if (!node) return;
    const { path, queryParams } = nodeLink(node);
    void this.router.navigate([path], { queryParams });
  }
}
