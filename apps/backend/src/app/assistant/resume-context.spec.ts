import { assistantResumeFixture, FIXTURE_TODAY } from '../../testing/resume.fixture';
import { buildResumeContext } from './resume-context';

const CURRENT = /current|present/i;

describe('buildResumeContext', () => {
  const context = () => buildResumeContext(assistantResumeFixture(), FIXTURE_TODAY);

  it('includes the profile name, headline and summary', () => {
    expect(context()).toContain('Ada Lovelace');
    expect(context()).toContain('Analytical Engine Programmer');
    expect(context()).toContain('Wrote the first program.');
  });

  it('includes each experience with company, role, period and highlight messages', () => {
    const text = context();
    for (const part of ['Acme', 'Lead Developer', '2024', 'Cut build time by 40%.']) {
      expect(text).toContain(part);
    }
    for (const part of [
      'Globex',
      'Developer',
      'Paris',
      '2019',
      '2021',
      'Shipped the billing engine.',
    ]) {
      expect(text).toContain(part);
    }
  });

  it('marks a job without an end date as current, and only then', () => {
    expect(context()).toMatch(CURRENT);

    const resume = assistantResumeFixture();
    resume.experiences[0].endDate = '2025-12-31';
    expect(buildResumeContext(resume, FIXTURE_TODAY)).not.toMatch(CURRENT);
  });

  it('includes projects with title, description and skill names', () => {
    const text = context();
    expect(text).toContain('Engine');
    expect(text).toContain('A mechanical computer.');
    expect(text).toContain('2023');
  });

  it('includes education', () => {
    const text = context();
    for (const part of ['MIT', 'BSc', 'Maths', '2015', '2018']) expect(text).toContain(part);
  });

  it('includes the skills with their categories', () => {
    const text = context();
    for (const part of ['Frameworks', 'Angular', 'Languages', 'Java']) expect(text).toContain(part);
  });

  it('writes no id', () => {
    expect(context()).not.toContain('ZZID-');
  });

  it('writes nothing for a null field (no phone line, no "null")', () => {
    const text = context();
    expect(text).not.toMatch(/phone/i);
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
  });

  it('still describes the resume when the profile is missing', () => {
    const resume = assistantResumeFixture();
    resume.profile = null;
    const text = buildResumeContext(resume, FIXTURE_TODAY);
    expect(text).toContain('Acme');
    expect(text).not.toContain('Ada Lovelace');
  });
});
