import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <section class="panel empty-state">
      <h2>404: no data for this query</h2>
      <p>This page does not exist.</p>
      <a class="button" routerLink="/">Back to home</a>
    </section>
  `,
})
export class NotFoundPage {}
