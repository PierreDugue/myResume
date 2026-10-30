import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import type { ResumeResponse } from '@my-resume/api-models';
import { Observable, of, Subject, throwError } from 'rxjs';
import { kx, resume, site, skills } from '../../admin/testing/fixtures';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { AboutPage } from './about-page';

/** Distinct counts so each stat can be told apart: 3 jobs, 5 highlights, 4 skills, 2 projects, 6 spans, 1 school. */
function content(): ResumeResponse {
  const base = structuredClone(resume);
  const third = {
    ...structuredClone(kx),
    id: 'e-third',
    highlights: [
      ...structuredClone(kx.highlights),
      { ...structuredClone(kx.highlights[1]), id: 'h-3' },
    ],
  };
  return {
    ...base,
    experiences: [...base.experiences, third], // 0 + 2 + 3 highlights
    skills: [...structuredClone(skills), { ...structuredClone(skills[0]), id: 's-extra' }],
    projects: [...base.projects, { ...structuredClone(site), id: 'p-two', slug: 'two' }], // 3 + 3 spans
  };
}

describe('AboutPage', () => {
  let load: () => Observable<ResumeResponse>;

  async function render({ settle = true } = {}) {
    TestBed.configureTestingModule({
      imports: [AboutPage],
      providers: [provideRouter([]), { provide: ContentApi, useValue: { resume: () => load() } }],
    });
    const fixture = TestBed.createComponent(AboutPage);
    // whenStable() waits for pending resources, so it can't be used while the call is in flight.
    if (settle) await fixture.whenStable();
    else fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function stat(el: HTMLElement, label: string): string | undefined {
    const panel = [...el.querySelectorAll('app-stat-panel')].find(
      (p) => p.querySelector('.label')?.textContent?.trim() === label,
    );
    return panel?.querySelector('.value')?.textContent?.trim();
  }

  beforeEach(() => (load = () => of(content())));

  it('has a heading for each section', async () => {
    const { el } = await render();
    const headings = [...el.querySelectorAll('h2')].map((h) => h.textContent?.trim());
    expect(headings).toEqual([
      "What you're looking at",
      'Not hardcoded: where the data comes from',
      'Live from the API',
      'Why there is an admin area',
      'Architecture',
      'AI-assisted development',
      'Decisions',
    ]);
    expect(el.querySelector('h1')).toBeNull();
  });

  it('shows the content counts fetched from the API right now', async () => {
    const { el } = await render();
    expect(stat(el, 'Experiences')).toBe('3');
    expect(stat(el, 'Highlights')).toBe('5');
    expect(stat(el, 'Skills')).toBe('4');
    expect(stat(el, 'Projects')).toBe('2');
    expect(stat(el, 'Project spans')).toBe('6');
    expect(stat(el, 'Education')).toBe('1');
  });

  it('lets visitors inspect the raw API response behind the counts', async () => {
    const { el, fixture } = await render();
    const live = [...el.querySelectorAll('app-panel')].find((p) =>
      p.querySelector('h2')?.textContent?.includes('Live from the API'),
    );
    expect(live?.textContent).toContain('Inspect data');
    $<HTMLButtonElement>(live as Element, 'button.panel-menu-toggle').click();
    await fixture.whenStable();
    [...(live as Element).querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.includes('Inspect data'))
      ?.click();
    await fixture.whenStable();
    const dialog = $(el, '[role="dialog"]');
    expect(dialog.textContent).toContain('"experiences"');
    expect(dialog.textContent).toContain('"e-third"');
  });

  it('shows a loading state while the API answers', async () => {
    const answer = new Subject<ResumeResponse>();
    load = () => answer;
    const { el, fixture } = await render({ settle: false });
    expect($(el, '[role="status"]').textContent).toContain('Loading');
    expect(el.querySelector('app-stat-panel')).toBeNull();

    answer.next(content());
    answer.complete();
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(stat(el, 'Experiences')).toBe('3');
  });

  it('explains a failed call instead of crashing, and can retry', async () => {
    let calls = 0;
    load = () => (calls++ === 0 ? throwError(() => new Error('offline')) : of(content()));
    const { el, fixture } = await render();
    expect($(el, '[role="alert"]').textContent).toContain("Couldn't reach the API right now");
    expect(el.querySelector('app-stat-panel')).toBeNull();
    // The rest of the page is still there.
    expect(el.textContent).toContain('Why there is an admin area');

    expect(calls).toBe(1);
    $<HTMLButtonElement>(el, 'button.retry').click();
    await fixture.whenStable();
    expect(calls).toBe(2);
    expect(stat(el, 'Experiences')).toBe('3');
  });

  it('links each concept to the page that shows it', async () => {
    const { el } = await render();
    const hrefs = [...el.querySelectorAll('.concepts a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/explore', '/traces', '/service-map', '/resume']);
  });

  it('links to the public repository files in a new tab', async () => {
    const { el } = await render();
    const repo = 'https://github.com/PierreDugue/myResume';
    for (const href of [
      `${repo}/blob/main/CLAUDE.md`,
      `${repo}/tree/main/.claude/agents`,
      `${repo}/blob/main/docs/spec.md`,
      repo,
    ]) {
      const link = $<HTMLAnchorElement>(el, `a[href="${href}"]`);
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect($(link, '.sr-only').textContent?.trim()).toBe('(opens in a new tab)');
    }
  });

  it('shows the request flow as an ordered list labelled by its heading', async () => {
    const { el } = await render();
    const flow = $(el, 'ol.flow');
    const heading = el.querySelector(`#${flow.getAttribute('aria-labelledby')}`);
    expect(heading?.tagName).toBe('H3');
    expect(heading?.textContent?.trim()).toBe('Request flow');
    const steps = [...el.querySelectorAll('ol.flow li')].map((li) => li.textContent?.trim());
    expect(steps.map((s) => s?.split(/\s/)[0])).toEqual([
      'Browser',
      'nginx',
      'NestJS',
      'PostgreSQL',
    ]);
  });
});
