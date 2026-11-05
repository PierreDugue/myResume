import { resumeFixture, TODAY } from './fixtures';
import { buildTrace, buildTraces } from './traces';

describe('buildTrace', () => {
  const trace = () => buildTrace(resumeFixture(), 'site', TODAY);

  it('describes the project, with its root span first', () => {
    const resume = resumeFixture();
    resume.projects[0].url = 'https://site.example.com';
    resume.projects[0].repoUrl = 'https://github.com/example/site';
    const t = buildTrace(resume, 'site', TODAY);
    expect(t).toMatchObject({
      slug: 'site',
      title: 'This site',
      description: 'd',
      url: 'https://site.example.com',
      repoUrl: 'https://github.com/example/site',
    });
    expect(t?.spans[0]).toEqual({
      id: 'p-site',
      parentId: null,
      depth: 0,
      name: 'This site',
      startDate: '2026-10-21',
      endDate: '2026-10-22',
      ongoing: true,
      durationDays: 2,
      offset: 0,
      width: 1,
      note: 'd',
      tech: [{ slug: 'angular', name: 'Angular' }],
    });
  });

  it('places each span on the root axis, in outline order', () => {
    const spans = trace()?.spans.slice(1) ?? [];
    expect(
      spans.map((s) => [s.name, s.depth, s.parentId, s.durationDays, s.offset, s.width]),
    ).toEqual([
      ['Design', 1, 'p-site', 1, 0, 0.5],
      ['Frontend', 1, 'p-site', 2, 0, 1],
      ['Dashboard', 2, 'sp-front', 1, 0.5, 0.5],
    ]);
    expect(spans[1]).toMatchObject({
      endDate: '2026-10-22',
      ongoing: true,
      tech: [
        { slug: 'angular', name: 'Angular' },
        { slug: 'ngrx', name: 'NgRx' },
      ],
    });
    expect(spans[0]).toMatchObject({ note: 'The spec.', ongoing: false, tech: [] });
  });

  it.each([
    {
      name: 'finished before today',
      projectEnd: '2026-10-22',
      edit: { span: 1, endDate: '2026-10-22' },
      today: '2026-10-31',
      expected: { endDate: '2026-10-22', ongoing: false, durationDays: 2 },
    },
    {
      name: 'ongoing, spans all ended',
      projectEnd: null,
      edit: { span: 1, endDate: '2026-10-22' },
      today: '2026-10-31',
      expected: { endDate: '2026-10-31', ongoing: true, durationDays: 11 },
    },
    {
      name: 'ongoing, span planned beyond today',
      projectEnd: null,
      edit: { span: 0, endDate: '2026-11-09' },
      today: TODAY,
      expected: { endDate: '2026-11-09', ongoing: true, durationDays: 20 },
    },
  ])(
    'ends the root at the project end date, or at today or its latest span when ongoing: $name',
    ({ projectEnd, edit, today, expected }) => {
      const resume = resumeFixture();
      resume.projects[0].endDate = projectEnd;
      resume.projects[0].spans[edit.span].endDate = edit.endDate;
      expect(buildTrace(resume, 'site', today)?.spans[0]).toMatchObject(expected);
    },
  );

  it('starts at the earliest span when the project has no start date', () => {
    const resume = resumeFixture();
    const undated = resume.projects[1];
    const span = (id: string, startDate: string, endDate: string, sortOrder: number) => ({
      id,
      parentId: null,
      depth: 0,
      name: id,
      startDate,
      endDate,
      note: null,
      skillIds: [],
      sortOrder,
    });
    undated.spans = [
      span('sp-build', '2026-10-05', '2026-10-10', 0),
      span('sp-spec', '2026-10-01', '2026-10-03', 1),
      span('sp-deploy', '2026-10-12', '2026-10-15', 2),
    ];
    undated.endDate = '2026-10-20';
    const t = buildTrace(resume, 'undated', TODAY);
    expect(t?.spans[0]).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-10-20',
      durationDays: 20,
    });
    // On a 20-day axis: build is 4 days in and 6 long, spec starts at 0 and is 3 long.
    expect(t?.spans.slice(1).map((s) => [s.id, s.offset, s.width])).toEqual([
      ['sp-build', 0.2, 0.3],
      ['sp-spec', 0, 0.15],
      ['sp-deploy', 0.55, 0.2],
    ]);
  });

  it('counts days across a month boundary of different lengths (February 2026 has 28 days)', () => {
    const resume = resumeFixture();
    const undated = resume.projects[1];
    const span = (id: string, startDate: string, endDate: string, sortOrder: number) => ({
      id,
      parentId: null,
      depth: 0,
      name: id,
      startDate,
      endDate,
      note: null,
      skillIds: [],
      sortOrder,
    });
    undated.spans = [
      span('sp-a', '2026-02-20', '2026-02-25', 0),
      span('sp-b', '2026-03-01', '2026-03-05', 1),
    ];
    undated.endDate = '2026-03-05';
    const t = buildTrace(resume, 'undated', TODAY);
    // 20 Feb to 5 Mar inclusive: 9 days left in February + 5 in March = 14.
    expect(t?.spans[0]).toMatchObject({ durationDays: 14, offset: 0, width: 1 });
    // a: 6 days from the start; b: starts 9 days in (20 Feb to 1 Mar) and lasts 5.
    expect(t?.spans.slice(1).map((s) => [s.id, s.durationDays, s.offset, s.width])).toEqual([
      ['sp-a', 6, 0, 0.4286],
      ['sp-b', 5, 0.6429, 0.3571],
    ]);
  });

  it('ends an ongoing span that starts in the future at its start', () => {
    const resume = resumeFixture();
    resume.projects[0].spans[0] = {
      ...resume.projects[0].spans[0],
      startDate: '2026-10-25',
      endDate: null,
    };
    const design = buildTrace(resume, 'site', TODAY)?.spans[1];
    expect(design).toMatchObject({
      startDate: '2026-10-25',
      endDate: '2026-10-25',
      durationDays: 1,
    });
  });

  it('ends an ongoing project that starts in the future at its start', () => {
    const resume = resumeFixture();
    resume.projects[0] = {
      ...resume.projects[0],
      startDate: '2027-01-01',
      endDate: null,
      spans: [],
    };
    const root = buildTrace(resume, 'site', TODAY)?.spans[0];
    expect(root).toMatchObject({
      startDate: '2027-01-01',
      endDate: '2027-01-01',
      ongoing: true,
      durationDays: 1,
      offset: 0,
      width: 1,
    });
  });

  it('returns null for an unknown slug or a project without dates or spans', () => {
    expect(buildTrace(resumeFixture(), 'nope', TODAY)).toBeNull();
    expect(buildTrace(resumeFixture(), 'undated', TODAY)).toBeNull();
  });
});

describe('buildTraces', () => {
  it('lists the projects that are traces, with their totals', () => {
    const resume = resumeFixture();
    resume.projects[0].skillIds = ['sk-claude'];
    expect(buildTraces(resume, TODAY)).toEqual([
      {
        slug: 'site',
        title: 'This site',
        startDate: '2026-10-21',
        endDate: '2026-10-22',
        ongoing: true,
        durationDays: 2,
        spanCount: 3,
        // The project's skill sorts after its spans' skills: skills-list order, not first use.
        tech: ['Angular', 'NgRx', 'Claude'],
      },
    ]);
  });
});
