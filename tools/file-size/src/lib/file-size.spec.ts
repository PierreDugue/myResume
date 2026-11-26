import { checkFileSizes, countLines, formatReport, isChecked, LIMITS } from './file-size.ts';

describe('LIMITS', () => {
  it('aims at about 500 lines and allows at most 800', () => {
    expect(LIMITS).toEqual({ target: 500, max: 800 });
  });
});

describe('isChecked', () => {
  it.each([
    'apps/backend/src/main.ts',
    'apps/frontend/src/app/x/x.spec.ts',
    'apps/frontend/src/app/x/x.html',
    'apps/frontend/src/styles.scss',
    'apps/frontend/public/theme-init.js',
    'eslint.config.mjs',
    'vitest.config.mts',
    'apps/frontend/src/app/x.css',
  ])('checks source code and tests: %s', (path) => {
    expect(isChecked(path)).toBe(true);
  });

  it.each([
    'docs/api-contract.md',
    'package-lock.json',
    'apps/frontend/project.json',
    '.github/workflows/ci.yml',
    'apps/frontend/nginx/test-real-ip.sh',
    'apps/frontend/public/og.png',
    'Dockerfile',
  ])('leaves docs, data and config alone: %s', (path) => {
    expect(isChecked(path)).toBe(false);
  });
});

describe('countLines', () => {
  it.each([
    ['', 0],
    ['one', 1],
    ['one\n', 1],
    ['one\ntwo', 2],
    ['one\ntwo\n', 2],
    ['one\r\ntwo\r\n', 2],
    ['\n\n', 2],
  ])('counts %j as %i lines, as an editor shows them', (text, lines) => {
    expect(countLines(text)).toBe(lines);
  });
});

describe('checkFileSizes', () => {
  const files = [
    { path: 'small.ts', lines: 500 },
    { path: 'medium.ts', lines: 501 },
    { path: 'at-max.ts', lines: 800 },
    { path: 'huge.ts', lines: 1908 },
    { path: 'big.ts', lines: 801 },
  ];

  it('rejects files over the maximum, biggest first', () => {
    expect(checkFileSizes(files).tooBig).toEqual([
      { path: 'huge.ts', lines: 1908 },
      { path: 'big.ts', lines: 801 },
    ]);
  });

  it('lists the files over the target but within the maximum, biggest first', () => {
    expect(checkFileSizes(files).overTarget).toEqual([
      { path: 'at-max.ts', lines: 800 },
      { path: 'medium.ts', lines: 501 },
    ]);
  });

  it('accepts other limits', () => {
    expect(checkFileSizes(files, { target: 1000, max: 1500 })).toEqual({
      tooBig: [{ path: 'huge.ts', lines: 1908 }],
      overTarget: [],
    });
  });

  it('finds nothing in an empty list', () => {
    expect(checkFileSizes([])).toEqual({ tooBig: [], overTarget: [] });
  });
});

describe('formatReport', () => {
  it('names each file too big and how to fix it', () => {
    const report = formatReport({ tooBig: [{ path: 'huge.ts', lines: 1908 }], overTarget: [] });
    expect(report).toContain('huge.ts');
    expect(report).toContain('1908');
    expect(report).toContain('800');
  });

  it('mentions the files over the target only as a count', () => {
    const report = formatReport({
      tooBig: [],
      overTarget: [
        { path: 'a.ts', lines: 700 },
        { path: 'b.ts', lines: 650 },
      ],
    });
    expect(report).toContain('2 files');
    expect(report).toContain('500');
    expect(report).not.toContain('a.ts');
  });

  it('is empty when every file is within the target', () => {
    expect(formatReport({ tooBig: [], overTarget: [] })).toBe('');
  });
});
