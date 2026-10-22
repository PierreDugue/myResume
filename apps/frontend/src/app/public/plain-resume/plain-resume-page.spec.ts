import { TestBed } from '@angular/core/testing';
import type { PublicProfile, ResumeResponse } from '@my-resume/api-models';
import { Observable, of, throwError } from 'rxjs';
import { resume } from '../../admin/testing/fixtures';
import { ContentApi } from '../../core/content/content-api.service';
import { $ } from '../../testing';
import { PlainResumePage } from './plain-resume-page';

describe('PlainResumePage', () => {
  let load: () => Observable<ResumeResponse>;

  async function render() {
    TestBed.configureTestingModule({
      imports: [PlainResumePage],
      providers: [{ provide: ContentApi, useValue: { resume: () => load() } }],
    });
    const fixture = TestBed.createComponent(PlainResumePage);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => (load = () => of(structuredClone(resume))));
  afterEach(() => vi.restoreAllMocks());

  it('shows the profile header with contact details and links', async () => {
    const { el } = await render();
    const header = $(el, 'header.resume-header');
    expect(header.textContent).toContain('Pierre Dugue');
    expect(header.textContent).toContain('Senior Front-End Engineer | Angular Specialist');
    expect(header.textContent).toContain('Nice, France');
    expect(header.textContent).toContain('open to relocation');
    expect($(header, 'a[href="mailto:pierre@example.com"]')).toBeTruthy();
    expect($(header, 'a[href="https://www.linkedin.com/in/example"]').textContent).toContain(
      'LinkedIn',
    );
  });

  it('does not show a phone number unless the API provides one', async () => {
    const { el } = await render();
    expect(el.querySelector('a[href^="tel:"]')).toBeNull();

    TestBed.resetTestingModule();
    load = () =>
      of({
        ...structuredClone(resume),
        profile: { ...(resume.profile as PublicProfile), phone: '+33 6 00 00 00 00' },
      });
    const second = await render();
    expect($(second.el, 'a[href^="tel:"]').textContent).toContain('+33 6 00 00 00 00');
  });

  it('lists experiences in order with period, summary, achievements and tech stack', async () => {
    const { el } = await render();
    const jobs = [...el.querySelectorAll('section.experience article')];
    expect(jobs.map((j) => $(j, 'h3').textContent?.trim())).toEqual([
      'Angular Front-End Engineer · Whoz',
      'Angular Front-End Engineer · KX',
    ]);
    expect(jobs[0].textContent).toContain('May 2026 – Present');
    expect(jobs[1].textContent).toContain('Sep 2022 – Nov 2025');
    expect(jobs[1].textContent).toContain(
      'Led front-end development of a data visualization platform.',
    );
    expect(
      [...jobs[1].querySelectorAll('li.highlight')].map((li) => li.textContent?.trim()),
    ).toEqual(['Cut average page load time by 35%.', 'Introduced an NX monorepo.']);
    expect(jobs[1].querySelector('.stack')?.textContent).toMatch(/Angular.*NgRx/s);
  });

  it('groups skills by category and shows education, projects and interests', async () => {
    const { el } = await render();
    const groups = [...el.querySelectorAll('section.skills dt')].map((d) => d.textContent?.trim());
    expect(groups).toEqual(['Core Frameworks', 'State & Reactive', 'Testing & Tools']);
    expect($(el, 'section.education').textContent).toContain('ESIL');
    expect($(el, 'section.education').textContent).toContain('Sep 2008 – Jun 2011');
    expect($(el, 'section.projects a[href="https://example.com"]').textContent).toContain(
      'Pierre O11y',
    );
    expect($(el, 'section.interests').textContent).toContain('Guitar and photography.');
  });

  it('offers a print button (Save as PDF)', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { el } = await render();
    $<HTMLButtonElement>(el, 'button.print').click();
    expect(print).toHaveBeenCalledOnce();
  });

  it('shows an error with a retry button when the resume cannot be loaded', async () => {
    let calls = 0;
    load = () =>
      calls++ === 0 ? throwError(() => new Error('offline')) : of(structuredClone(resume));
    const { el, fixture } = await render();
    expect($(el, '[role="alert"]').textContent).toContain('could not be loaded');

    $<HTMLButtonElement>(el, 'button.retry').click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Pierre Dugue');
  });
});
