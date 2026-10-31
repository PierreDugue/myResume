import { TestBed } from '@angular/core/testing';
import type { QualityTests } from '@my-resume/api-models';
import { partialQualityFixture, qualityFixture } from '../../testing/quality-fixture';
import { TestResults } from './test-results';

async function render(tests: QualityTests): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(TestResults);
  fixture.componentRef.setInput('tests', tests);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const cells = (row: Element) =>
  [...row.children].map((c) => c.textContent?.replace(/\s+/g, ' ').trim());

describe('TestResults', () => {
  it('lists the three suites with their counts and pass rate', async () => {
    const el = await render(qualityFixture().tests);
    const [suites] = el.querySelectorAll('table');
    expect(suites.querySelector('caption')?.textContent).toContain('suite');
    expect([...suites.querySelectorAll('tbody tr')].map(cells)).toEqual([
      ['Unit', '640', '636', '0', '4', '100.0 %'],
      ['Integration', '60', '58', '2 failing', '0', '96.7 %'],
      ['End-to-end', 'not run in CI yet'],
    ]);
  });

  it('uses column and row headers', async () => {
    const el = await render(qualityFixture().tests);
    const [suites] = el.querySelectorAll('table');
    expect([...suites.querySelectorAll('thead th')].map((th) => th.getAttribute('scope'))).toEqual(
      Array(6).fill('col'),
    );
    expect(suites.querySelector('tbody th')?.getAttribute('scope')).toBe('row');
  });

  it('lists each project with its suite', async () => {
    const el = await render(qualityFixture().tests);
    const projects = el.querySelectorAll('table')[1];
    expect(projects.querySelector('caption')?.textContent).toContain('project');
    expect([...projects.querySelectorAll('tbody tr')].map(cells)).toEqual([
      ['backend · unit', '250', '250', '0', '0', '100.0 %'],
      ['frontend · unit', '330', '326', '0', '4', '100.0 %'],
      ['query-parser · unit', '40', '40', '0', '0', '100.0 %'],
      ['resume-metrics · unit', '20', '20', '0', '0', '100.0 %'],
      ['backend · integration', '60', '58', '2 failing', '0', '96.7 %'],
    ]);
  });

  it('flags failures in text, not only with color', async () => {
    const el = await render(qualityFixture().tests);
    const failed = el.querySelectorAll('table')[0].querySelectorAll('tbody tr')[1].children[3];
    expect(failed.classList.contains('failed')).toBe(true);
    expect(failed.querySelector('.sr-only')?.textContent).toContain('failing');
  });

  it('shows what a partial report has: one suite, missing ones as not run', async () => {
    const el = await render(partialQualityFixture().tests);
    const [suites] = el.querySelectorAll('table');
    expect([...suites.querySelectorAll('tbody tr')].map((r) => cells(r)[1])).toEqual([
      '20',
      'not run in CI yet',
      'not run in CI yet',
    ]);
  });

  it('leaves out the project table when there are no projects', async () => {
    const tests = { ...qualityFixture().tests, projects: [] };
    const el = await render(tests);
    expect(el.querySelectorAll('table')).toHaveLength(1);
  });

  it('shows a dash for a suite that ran no test', async () => {
    const tests = qualityFixture().tests;
    tests.suites[0] = { suite: 'unit', total: 0, passed: 0, failed: 0, skipped: 0, passRate: null };
    const el = await render(tests);
    expect(cells(el.querySelector('tbody tr') as Element)[5]).toBe('–');
  });
});
