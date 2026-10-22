import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Home dashboard ("Career Overview"). Panels are added in build step 4 (see docs/spec.md). */
@Component({
  selector: 'app-overview-page',
  imports: [RouterLink],
  template: `
    <section class="panel empty-state">
      <h2>Dashboards are on their way</h2>
      <p>
        This resume will soon be an observability platform. In the meantime, the
        <a routerLink="/resume">plain view</a> has everything.
      </p>
    </section>
  `,
})
export class OverviewPage {}
