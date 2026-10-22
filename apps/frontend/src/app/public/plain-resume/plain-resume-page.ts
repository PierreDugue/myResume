import { Component } from '@angular/core';

/** Classic one-page resume. Content arrives with build step 3 (see docs/spec.md). */
@Component({
  selector: 'app-plain-resume-page',
  template: `
    <section class="panel empty-state">
      <h2>Plain view</h2>
      <p>The classic, printable resume will appear here.</p>
    </section>
  `,
})
export class PlainResumePage {}
