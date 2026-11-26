import { Component, input, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PublicProfile, ResumeResponse } from '@my-resume/api-models';
import { resume } from '../../admin/testing/fixtures';
import { $ } from '../../testing';
import { PlainResume } from './plain-resume';
import {
  RESUME_EDIT_SLOTS,
  ResumeFieldRef,
  ResumeItemRef,
  ResumeSectionKind,
} from './resume-edit-slots';

/** A readable key for a field reference: `profile.email`, `experience:e-kx.role`, ... */
function fieldKey(ref: ResumeFieldRef): string {
  if (ref.kind === 'highlight') return `highlight:${ref.experienceId}/${ref.id}`;
  if (ref.kind === 'profile') return `profile.${ref.field}`;
  return `${ref.kind}:${ref.id}.${ref.field}`;
}

@Component({
  selector: 'app-fake-field',
  template: `<i class="fake-field" [attr.data-ref]="key()">{{ value() ?? 'NULL' }}</i>`,
})
class FakeField {
  readonly ref = input.required<ResumeFieldRef>();
  readonly value = input.required<string | null>();
  protected key = () => fieldKey(this.ref());
}

@Component({
  selector: 'app-fake-item',
  template: `<b class="fake-item" [attr.data-ref]="key()"></b>`,
})
class FakeItem {
  readonly item = input.required<ResumeItemRef>();
  protected key = () => {
    const item = this.item();
    return item.kind === 'profile' ? 'profile' : `${item.kind}:${item.id}`;
  };
}

@Component({
  selector: 'app-fake-section',
  template: `<u class="fake-section" [attr.data-section]="section()"></u>`,
})
class FakeSection {
  readonly section = input.required<ResumeSectionKind>();
}

@Component({
  imports: [PlainResume],
  template: `<app-plain-resume [resume]="data"
    ><button class="projected">Print</button></app-plain-resume
  >`,
})
class Host {
  data: ResumeResponse = structuredClone(resume);
}

const EDIT_SLOTS: Provider = {
  provide: RESUME_EDIT_SLOTS,
  useValue: { field: FakeField, item: FakeItem, section: FakeSection },
};

function render(data: ResumeResponse, edit: boolean) {
  TestBed.configureTestingModule({ providers: edit ? [EDIT_SLOTS] : [] });
  const fixture = TestBed.createComponent(PlainResume);
  fixture.componentRef.setInput('resume', data);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const publicProfile = resume.profile as PublicProfile;
const emptyResume: ResumeResponse = {
  profile: publicProfile,
  experiences: [],
  education: [],
  skills: [],
  projects: [],
};

describe('PlainResume', () => {
  describe('in public mode (no edit slots)', () => {
    it('links the email and the project title, as the classic layout did', () => {
      const el = render(structuredClone(resume), false);
      expect($(el, 'header.resume-header a[href="mailto:pierre@example.com"]').textContent).toBe(
        'pierre@example.com',
      );
      expect($(el, 'section.projects h3 a[href="https://example.com"]').textContent).toContain(
        'Pierre O11y',
      );
    });

    it('shows the phone only when the profile has one', () => {
      expect(render(structuredClone(resume), false).querySelector('a[href^="tel:"]')).toBeNull();
      TestBed.resetTestingModule();
      const el = render(
        { ...structuredClone(resume), profile: { ...publicProfile, phone: '+33 6 00 00 00 00' } },
        false,
      );
      expect($(el, 'a[href^="tel:"]').textContent).toContain('+33 6 00 00 00 00');
    });

    it('leaves out empty sections, empty optional texts and every editing control', () => {
      const el = render(
        { ...emptyResume, profile: { ...publicProfile, location: null, interests: null } },
        false,
      );
      expect($(el, 'header.resume-header h2').textContent).toBe('Pierre Dugue');
      for (const section of ['skills', 'experience', 'projects', 'education', 'interests']) {
        expect(el.querySelector(`section.${section}`)).toBeNull();
      }
      expect(el.querySelector('button, input, textarea')).toBeNull();
    });

    it('lists each skill name once, comma separated within its category', () => {
      const data = structuredClone(resume);
      data.skills = [
        { ...data.skills[0] },
        { ...data.skills[1], category: data.skills[0].category },
        data.skills[2],
      ];
      const el = render(data, false);
      const groups = [...el.querySelectorAll('section.skills dd')].map((d) =>
        d.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(groups).toEqual(['Angular, NgRx', 'Jest']);
    });
  });

  describe('in edit mode (edit slots provided)', () => {
    const fields = (el: HTMLElement) =>
      new Map(
        [...el.querySelectorAll('.fake-field')].map((f) => [
          f.getAttribute('data-ref'),
          f.textContent,
        ]),
      );
    const refs = (el: HTMLElement, selector: string) =>
      [...el.querySelectorAll(selector)].map((e) => e.getAttribute('data-ref'));

    it('renders each editable text through the field slot with its reference and value', () => {
      const f = fields(render(structuredClone(resume), true));

      expect(Object.fromEntries(f)).toEqual({
        'profile.fullName': 'Pierre Dugue',
        'profile.headline': 'Senior Front-End Engineer | Angular Specialist',
        'profile.email': 'pierre@example.com',
        'profile.location': 'Nice, France',
        'profile.summary': 'Senior Angular developer.',
        'profile.interests': 'Guitar and photography.',
        'skill:s-angular.name': 'Angular',
        'skill:s-ngrx.name': 'NgRx',
        'skill:s-jest.name': 'Jest',
        'experience:e-whoz.role': 'Angular Front-End Engineer',
        'experience:e-whoz.company': 'Whoz',
        'experience:e-whoz.location': 'Full Remote',
        'experience:e-whoz.summary': 'NULL',
        'experience:e-kx.role': 'Angular Front-End Engineer',
        'experience:e-kx.company': 'KX',
        'experience:e-kx.location': 'Full Remote',
        'experience:e-kx.summary': 'Led front-end development of a data visualization platform.',
        'highlight:e-kx/h-1': 'Cut average page load time by 35%.',
        'highlight:e-kx/h-2': 'Introduced an NX monorepo.',
        'project:p-site.title': 'Pierre O11y',
        'project:p-site.description': 'This site.',
        'education:ed-esil.school': 'ESIL',
        'education:ed-esil.degree': "Diplôme d'ingénieur",
        'education:ed-esil.field': 'Computer Science',
        'education:ed-esil.location': 'Marseille, France',
        'education:ed-esil.description': 'NULL',
      });
    });

    it('still renders empty optional texts, with a null value, so they can be filled in', () => {
      const data = structuredClone(resume);
      data.profile = { ...publicProfile, location: null, interests: null };
      data.education = [{ ...data.education[0], field: null, location: null, description: null }];
      const f = fields(render(data, true));
      for (const key of [
        'profile.location',
        'profile.interests',
        'education:ed-esil.field',
        'education:ed-esil.location',
        'education:ed-esil.description',
        'experience:e-whoz.summary',
      ]) {
        expect(f.get(key), key).toBe('NULL');
      }
    });

    it('shows the phone through the field slot only when the profile has one', () => {
      expect(fields(render(structuredClone(resume), true)).has('profile.phone')).toBe(false);
      TestBed.resetTestingModule();
      const f = fields(
        render(
          { ...structuredClone(resume), profile: { ...publicProfile, phone: '+33 6 00 00 00 00' } },
          true,
        ),
      );
      expect(f.get('profile.phone')).toBe('+33 6 00 00 00 00');
    });

    it('gives each item the item slot, in layout order', () => {
      const el = render(structuredClone(resume), true);
      expect(refs(el, '.fake-item')).toEqual([
        'profile',
        'skill:s-angular',
        'skill:s-ngrx',
        'skill:s-jest',
        'experience:e-whoz',
        'experience:e-kx',
        'project:p-site',
        'education:ed-esil',
      ]);
      // each experience, project and education item belongs to its own article
      expect($(el, 'section.experience article:nth-of-type(2) .fake-item').dataset['ref']).toBe(
        'experience:e-kx',
      );
    });

    it('still offers the profile item slot when there is no profile yet', () => {
      const el = render({ ...structuredClone(resume), profile: null }, true);
      expect(refs(el, '.fake-item')).toContain('profile');
      expect([...fields(el).keys()].some((k) => k?.startsWith('profile.'))).toBe(false);
    });

    it('ends each of the four sections with the section slot', () => {
      const el = render(structuredClone(resume), true);
      for (const [css, kind] of [
        ['skills', 'skill'],
        ['experience', 'experience'],
        ['projects', 'project'],
        ['education', 'education'],
      ]) {
        const section = $(el, `section.${css}`);
        const slots = section.querySelectorAll('.fake-section');
        expect(slots, css).toHaveLength(1);
        expect(slots[0].getAttribute('data-section')).toBe(kind);
        // after the last item (and not inside it)
        const items = [...section.querySelectorAll('article, dl')];
        const lastItem = items[items.length - 1];
        expect(lastItem?.compareDocumentPosition(slots[0])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      }
      expect(el.querySelectorAll('.fake-section')).toHaveLength(4);
    });

    it('keeps empty sections visible so items can be added to them', () => {
      const el = render(emptyResume, true);
      for (const [css, kind] of [
        ['skills', 'skill'],
        ['experience', 'experience'],
        ['projects', 'project'],
        ['education', 'education'],
      ]) {
        expect($(el, `section.${css} .fake-section`).getAttribute('data-section')).toBe(kind);
      }
    });

    it('renders no link around a text that is editable (no interactive element inside a link)', () => {
      const el = render(
        { ...structuredClone(resume), profile: { ...publicProfile, phone: '+33 6 00 00 00 00' } },
        true,
      );
      expect(el.querySelectorAll('a .fake-field')).toHaveLength(0);
      // the profile links stay links
      expect(
        $(el, 'header.resume-header a[href="https://www.linkedin.com/in/example"]'),
      ).toBeTruthy();
    });

    it('shows each skill name individually, comma separated, in its category', () => {
      const data = structuredClone(resume);
      data.skills = [
        { ...data.skills[0] },
        { ...data.skills[1], category: data.skills[0].category },
        data.skills[2],
      ];
      const el = render(data, true);
      const groups = [...el.querySelectorAll('section.skills dd')].map((d) =>
        d.textContent?.replace(/\s+/g, ' ').replace(/ ,/g, ',').trim(),
      );
      expect(groups).toEqual(['Angular, NgRx', 'Jest']);
    });

    it('keeps the period and the tech stack lines of an experience', () => {
      const el = render(structuredClone(resume), true);
      const meta = [...el.querySelectorAll('section.experience .meta')].map((m) =>
        m.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(meta[1]).toContain('Sep 2022 – Nov 2025');
      expect($(el, 'section.experience article:nth-of-type(2) .stack').textContent).toMatch(
        /Tech stack:\s*Angular, NgRx/,
      );
    });
  });

  it('projects its content into the toolbar at the top', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect($(el, '.toolbar.no-print button.projected').textContent).toBe('Print');
    expect($(el, 'article.resume').firstElementChild?.classList.contains('toolbar')).toBe(true);
  });
});
