import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import type { QualityReport } from '@my-resume/api-models';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { renderRoute } from '../../admin/testing/render';
import { QualityApi } from '../../core/quality/quality-api.service';
import { ECHARTS_LOADER } from '../../shared/panels/echart/echarts-loader';
import { $ } from '../../testing';
import { QualityPage } from './quality-page';
import {
  lighthouseQualityFixture,
  partialQualityFixture,
  qualityFixture,
} from './testing/quality-fixture';

@Component({ template: 'elsewhere' })
class Elsewhere {}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
const cells = (row: Element | null | undefined) =>
  [...(row?.children ?? [])].map((c) => text(c)).join(' ');

describe('QualityPage', () => {
  let respond: () => Observable<QualityReport | null>;
  const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn() };
  const render = () =>
    renderRoute(
      '/dashboards/quality',
      [
        { path: 'dashboards/quality', component: QualityPage },
        { path: '**', component: Elsewhere },
      ],
      [
        { provide: QualityApi, useValue: { get: () => respond() } },
        { provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init: () => chart }) },
      ],
    );
  const panel = (el: HTMLElement, title: string) => {
    const found = [...el.querySelectorAll('app-panel')].find(
      (p) => text(p.querySelector('h2')) === title,
    );
    if (!found) throw new Error(`No panel titled "${title}"`);
    return found as HTMLElement;
  };
  const openMenuItem = async (
    root: HTMLElement,
    settle: () => Promise<void>,
    name: string,
  ): Promise<void> => {
    $<HTMLButtonElement>(root, 'button[aria-haspopup="menu"]').click();
    await settle();
    [...root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.includes(name))
      ?.click();
    await settle();
  };

  beforeEach(() => {
    chart.setOption.mockClear();
    respond = () => of(qualityFixture());
  });

  describe('with a full report', () => {
    it('shows the five stats', async () => {
      const { el } = await render();
      const stats = [...el.querySelectorAll('app-stat-panel')].map((s) => [
        text(s.querySelector('.label')),
        text(s.querySelector('.value')),
        text(s.querySelector('.hint')),
      ]);
      expect(stats).toEqual([
        ['Tests', '700', '2 failed, 4 skipped'],
        ['Pass rate', '99.7 %', 'skipped tests excluded'],
        ['Initial bundle', '412.3 kB', 'of 500.0 kB budget'],
        ['CI duration', '6 min 12 s', 'checks run in parallel'],
        ['Last deploy', '2026-10-31 14:02 UTC', 'commit a1b2c3d'],
      ]);
    });

    it('has a panel for each part of the report', async () => {
      const { el } = await render();
      expect([...el.querySelectorAll('app-panel h2')].map((h) => text(h))).toEqual([
        'Tests',
        'Code coverage',
        'Bundle vs budget',
        'Lighthouse',
        'CI jobs',
        'Nx project graph',
      ]);
    });

    it('gives every panel an info tooltip', async () => {
      const { el } = await render();
      const panels = el.querySelectorAll('app-panel');
      expect(panels).toHaveLength(6);
      panels.forEach((p) => expect(p.querySelector('.info')).not.toBeNull());
    });

    it('lists the test suites', async () => {
      const { el } = await render();
      expect(text(panel(el, 'Tests'))).toContain('not run in CI yet');
      expect(panel(el, 'Tests').querySelectorAll('app-test-results table')).toHaveLength(2);
    });

    it('shows the coverage as bars of the lines percentage', async () => {
      const { el } = await render();
      const items = [...panel(el, 'Code coverage').querySelectorAll('li')].map((li) => [
        text(li.querySelector('.name')),
        text(li.querySelector('.amount')),
      ]);
      expect(items[0][1]).toBe('91.2 %');
      expect(items.map((i) => i[0]?.split(' stmts')[0])).toEqual([
        'backend',
        'backend · integration',
        'frontend',
        'query-parser',
        'resume-metrics',
      ]);
      // Percentages scale to 100: 87.3 % fills 87.3 % of the track.
      const widths = [...panel(el, 'Code coverage').querySelectorAll<HTMLElement>('.fill')].map(
        (f) => f.style.width,
      );
      expect(widths[2]).toBe('87.3%');
    });

    it('offers the coverage as a table with all four metrics', async () => {
      const { el, settle } = await render();
      await openMenuItem(panel(el, 'Code coverage'), settle, 'table');
      const table = panel(el, 'Code coverage').querySelector('table');
      expect([...(table?.querySelectorAll('thead th') ?? [])].map((th) => text(th))).toEqual([
        'Project',
        'Kind',
        'Lines',
        'Statements',
        'Functions',
        'Branches',
      ]);
      expect(cells(table?.querySelectorAll('tbody tr')[2])).toBe(
        'frontend App 87.3 % 86.9 % 80.4 % 75.6 %',
      );
      expect(table?.querySelector('caption')).not.toBeNull();
    });

    it('shows the bundle against its budget', async () => {
      const { el } = await render();
      expect(text(panel(el, 'Bundle vs budget').querySelector('.status'))).toContain(
        'Within budget',
      );
    });

    it('says Lighthouse is not measured yet, without an error', async () => {
      const { el } = await render();
      const lighthouse = panel(el, 'Lighthouse');
      expect(text(lighthouse)).toContain('Not measured yet');
      expect(lighthouse.querySelector('[role="alert"]')).toBeNull();
    });

    it('lists the CI jobs with their durations', async () => {
      const { el } = await render();
      const jobs = [...panel(el, 'CI jobs').querySelectorAll('li')].map((li) => [
        text(li.querySelector('.name')),
        text(li.querySelector('.amount')),
      ]);
      expect(jobs[1]).toEqual(['Unit tests', '3 min 30 s']);
      expect(jobs).toHaveLength(4);
    });

    it('draws the project graph', async () => {
      const { el } = await render();
      expect(panel(el, 'Nx project graph').querySelectorAll('app-echart')).toHaveLength(1);
      expect(chart.setOption).toHaveBeenCalled();
    });

    it('offers the project graph as a table', async () => {
      const { el, settle } = await render();
      await openMenuItem(panel(el, 'Nx project graph'), settle, 'table');
      const table = panel(el, 'Nx project graph').querySelector('table');
      expect([...(table?.querySelectorAll('thead th') ?? [])].map((th) => text(th))).toEqual([
        'Project',
        'Kind',
        'Root',
        'Depends on',
      ]);
      expect(cells(table?.querySelector('tbody tr'))).toBe(
        'backend App apps/backend api-models, query-parser, resume-metrics',
      );
      expect(table?.querySelector('caption')).not.toBeNull();
    });

    it('lets the visitor inspect the data behind a panel', async () => {
      const { el, settle } = await render();
      await openMenuItem(panel(el, 'Bundle vs budget'), settle, 'Inspect data');
      expect(text(el.querySelector('[role="dialog"] pre'))).toContain('"initialBytes": 412340');
    });

    it('links to the commit and the CI run', async () => {
      const { el } = await render();
      const links = [...el.querySelectorAll<HTMLAnchorElement>('.source a')];
      expect(links.map((a) => [text(a), a.getAttribute('href')])).toEqual([
        ['a1b2c3d', 'https://github.com/PierreDugue/myResume/commit/a1b2c3d4e5f6'],
        ['CI run', 'https://github.com/PierreDugue/myResume/actions/runs/123456'],
      ]);
    });
  });

  it('shows the Lighthouse scores once they are measured', async () => {
    respond = () => of(lighthouseQualityFixture());
    const { el } = await render();
    expect(el.querySelectorAll('app-lighthouse-scores li')).toHaveLength(4);
    expect(text(panel(el, 'Lighthouse'))).not.toContain('Not measured yet');
  });

  describe('with a partial report', () => {
    beforeEach(() => (respond = () => of(partialQualityFixture())));

    it('says what is not measured yet, with a reason, inside the panels', async () => {
      const { el } = await render();
      for (const title of ['Code coverage', 'Bundle vs budget', 'Lighthouse', 'CI jobs']) {
        const body = text(panel(el, title));
        expect(body, title).toContain('Not measured yet');
      }
      expect(text(panel(el, 'CI jobs'))).toContain('outside GitHub Actions');
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('still shows the tests and the stats it has', async () => {
      const { el } = await render();
      expect(text(el.querySelector('app-stat-panel .value'))).toBe('20');
      expect(panel(el, 'Tests').querySelectorAll('table')).toHaveLength(2);
      expect(el.querySelector('.source')).toBeNull();
    });
  });

  it('explains that this build has no report (a 404, not an error)', async () => {
    respond = () => of(null);
    const { el } = await render();
    const empty = $(el, '.empty-state');
    expect(text(empty)).toContain('CI pipeline');
    expect(text(empty)).toContain('no quality report');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('app-panel')).toBeNull();
  });

  it('shows a loading message while the report is on its way', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: QualityApi, useValue: { get: () => NEVER } },
        { provide: ECHARTS_LOADER, useValue: () => Promise.resolve({ init: () => chart }) },
      ],
    });
    const fixture = TestBed.createComponent(QualityPage);
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toContain('Loading the quality report');
  });

  it('shows an error with a retry button that loads again', async () => {
    let calls = 0;
    respond = () =>
      ++calls === 1
        ? throwError(() => new HttpErrorResponse({ status: 500 }))
        : of(qualityFixture());
    const { el, settle } = await render();
    expect($(el, '[role="alert"]').textContent).toContain('could not be loaded');
    $<HTMLButtonElement>(el, 'button.button').click();
    await settle();
    expect(calls).toBe(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('app-panel')).toHaveLength(6);
  });
});
