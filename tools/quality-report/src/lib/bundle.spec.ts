import type { AngularProjectJson, EsbuildMetafile } from './inputs.ts';
import { bundleSizesFromMetafile, initialBudgetFromProject, parseBudgetBytes } from './bundle.ts';

/**
 * main → A → B (import-statement), main ⇢ L (dynamic import), L → A and L → C.
 * Initial: main 100 + polyfills 10 + A 50 + B 5 + global styles 20 = 185.
 * Lazy: L 300 + C 40 + lazy-styles 8 = 348. Source maps and component styles don't count.
 */
const metafile: EsbuildMetafile = {
  outputs: {
    'main-ABCDEFGH.js': {
      bytes: 100,
      entryPoint: 'apps/frontend/src/main.ts',
      imports: [
        { path: 'chunk-A.js', kind: 'import-statement' },
        { path: 'chunk-L.js', kind: 'dynamic-import' },
      ],
    },
    'main-ABCDEFGH.js.map': { bytes: 9999, imports: [] },
    'polyfills-ABCDEFGH.js': { bytes: 10, entryPoint: 'angular:polyfills', imports: [] },
    'chunk-A.js': {
      bytes: 50,
      imports: [
        { path: 'chunk-B.js', kind: 'import-statement' },
        // a cycle back to main must not loop
        { path: 'main-ABCDEFGH.js', kind: 'import-statement' },
      ],
    },
    'chunk-B.js': { bytes: 5, imports: [] },
    'chunk-L.js': {
      bytes: 300,
      entryPoint: 'apps/frontend/src/app/lazy/lazy-page.ts',
      imports: [
        { path: 'chunk-A.js', kind: 'import-statement' },
        { path: 'chunk-C.js', kind: 'import-statement' },
      ],
    },
    'chunk-C.js': { bytes: 40, imports: [] },
    'styles-ABCDEFGH.css': { bytes: 20, entryPoint: 'angular:styles/global:styles', imports: [] },
    'lazy-styles-ABCDEFGH.css': { bytes: 8, imports: [] },
    'panel-ABCDEFGH.css': { bytes: 700, imports: [], 'ng-component': true },
  },
};

describe('bundleSizesFromMetafile', () => {
  it('sums the initial files (entries, their static imports, global styles) and the lazy ones', () => {
    expect(bundleSizesFromMetafile(metafile)).toEqual({ initialBytes: 185, lazyBytes: 348 });
  });

  it('recognizes entries without an output hash (outputHashing: none)', () => {
    const unhashed: EsbuildMetafile = {
      outputs: {
        'main.js': {
          bytes: 1,
          entryPoint: 'src/main.ts',
          imports: [{ path: 'chunk-X.js', kind: 'import-statement' }],
        },
        'polyfills.js': { bytes: 2, entryPoint: 'angular:polyfills', imports: [] },
        'chunk-X.js': { bytes: 4, imports: [] },
        'styles.css': { bytes: 8, entryPoint: 'angular:styles/global:styles', imports: [] },
      },
    };
    expect(bundleSizesFromMetafile(unhashed)).toEqual({ initialBytes: 15, lazyBytes: 0 });
  });

  it('follows @import rules of the global styles and skips external imports', () => {
    const withImports: EsbuildMetafile = {
      outputs: {
        'main-ABCDEFGH.js': {
          bytes: 1,
          entryPoint: 'src/main.ts',
          imports: [
            { path: 'https://cdn.example.com/x.js', kind: 'import-statement', external: true },
          ],
        },
        'styles-ABCDEFGH.css': {
          bytes: 2,
          entryPoint: 'angular:styles/global:styles',
          imports: [{ path: 'fonts-ABCDEFGH.css', kind: 'import-rule' }],
        },
        'fonts-ABCDEFGH.css': { bytes: 4, imports: [] },
      },
    };
    expect(bundleSizesFromMetafile(withImports)).toEqual({ initialBytes: 7, lazyBytes: 0 });
  });
});

describe('parseBudgetBytes (as Angular counts: 1 kB = 1000 bytes)', () => {
  it.each([
    ['500kb', 500_000],
    ['1mb', 1_000_000],
    ['1.5MB', 1_500_000],
    ['2gb', 2_000_000_000],
    ['300b', 300],
    ['1234', 1234],
    [' 4 kB ', 4000],
  ])('%s → %d bytes', (value, bytes) => {
    expect(parseBudgetBytes(value)).toBe(bytes);
  });

  it('adds the value to a baseline', () => {
    expect(parseBudgetBytes('10kb', '1mb')).toBe(1_010_000);
  });

  it('reads a percentage of the baseline', () => {
    expect(parseBudgetBytes('10%', '500kb')).toBe(550_000);
  });

  it('is null for a value it cannot read', () => {
    expect(parseBudgetBytes('lots')).toBeNull();
    expect(parseBudgetBytes(undefined)).toBeNull();
  });
});

describe('initialBudgetFromProject', () => {
  const project: AngularProjectJson = {
    targets: {
      build: {
        configurations: {
          production: {
            budgets: [
              { type: 'anyComponentStyle', maximumWarning: '4kb', maximumError: '8kb' },
              { type: 'initial', maximumWarning: '500kb', maximumError: '1mb' },
            ],
          },
        },
      },
    },
  };

  it('reads the production "initial" budget', () => {
    expect(initialBudgetFromProject(project)).toEqual({
      budgetWarningBytes: 500_000,
      budgetErrorBytes: 1_000_000,
    });
  });

  it('is null for a limit that is not set', () => {
    const warningOnly: AngularProjectJson = {
      targets: {
        build: {
          configurations: { production: { budgets: [{ type: 'initial', maximumWarning: '2mb' }] } },
        },
      },
    };
    expect(initialBudgetFromProject(warningOnly)).toEqual({
      budgetWarningBytes: 2_000_000,
      budgetErrorBytes: null,
    });
  });

  it('is null without an initial budget or without the project file', () => {
    expect(initialBudgetFromProject({ targets: {} })).toEqual({
      budgetWarningBytes: null,
      budgetErrorBytes: null,
    });
    expect(initialBudgetFromProject(null)).toEqual({
      budgetWarningBytes: null,
      budgetErrorBytes: null,
    });
  });
});
