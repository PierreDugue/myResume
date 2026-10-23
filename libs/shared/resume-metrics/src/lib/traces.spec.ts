import { resumeFixture, TODAY } from './fixtures';
import { buildTrace, buildTraces } from './traces';

describe('buildTrace', () => {
  const trace = () => buildTrace(resumeFixture(), 'site', TODAY);

  it('describes the project, with its root span first', () => {
    const t = trace();
    expect(t).toMatchObject({
      slug: 'site',
      title: 'This site',
      description: 'd',
      url: null,
      repoUrl: null,
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

  it('ends a finished project at its end date, and an ongoing one at its latest span', () => {
    const resume = resumeFixture();
    resume.projects[0].endDate = '2026-10-31';
    resume.projects[0].spans[1].endDate = '2026-10-31';
    expect(buildTrace(resume, 'site', TODAY)?.spans[0]).toMatchObject({
      endDate: '2026-10-31',
      ongoing: false,
      durationDays: 11,
    });

    const planned = resumeFixture();
    planned.projects[0].spans[0].endDate = '2026-11-09'; // planned beyond today
    expect(buildTrace(planned, 'site', TODAY)?.spans[0]).toMatchObject({
      endDate: '2026-11-09',
      ongoing: true,
      durationDays: 20,
    });
  });

  it('starts at the first span when the project has no start date', () => {
    const resume = resumeFixture();
    const undated = resume.projects[1];
    undated.spans = [
      {
        id: 'sp-1',
        parentId: null,
        depth: 0,
        name: 'Build',
        startDate: '2026-10-01',
        endDate: '2026-10-10',
        note: null,
        skillIds: [],
        sortOrder: 0,
      },
    ];
    undated.endDate = '2026-10-20';
    const t = buildTrace(resume, 'undated', TODAY);
    expect(t?.spans[0]).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-10-20',
      durationDays: 20,
    });
    expect(t?.spans[1]).toMatchObject({ offset: 0, width: 0.5 });
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

  it('returns null for an unknown slug or a project without dates or spans', () => {
    expect(buildTrace(resumeFixture(), 'nope', TODAY)).toBeNull();
    expect(buildTrace(resumeFixture(), 'undated', TODAY)).toBeNull();
  });
});

describe('buildTraces', () => {
  it('lists the projects that are traces, with their totals', () => {
    expect(buildTraces(resumeFixture(), TODAY)).toEqual([
      {
        slug: 'site',
        title: 'This site',
        startDate: '2026-10-21',
        endDate: '2026-10-22',
        ongoing: true,
        durationDays: 2,
        spanCount: 3,
        // The project's skills and its spans', in skills-list order.
        tech: ['Angular', 'NgRx', 'Claude'],
      },
    ]);
  });
});
