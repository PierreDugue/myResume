#!/usr/bin/env node
// Summarizes a Stryker JSON report for reviewing unit tests.
//
// Usage: node tools/mutation/summary.mjs <report.json> [source-file-filter]
//   e.g. node tools/mutation/summary.mjs coverage/resume-metrics/mutation/report.json traces.ts
//
// Prints:
//   1. Surviving and uncovered mutants (file:line, mutator, original line, replacement).
//   2. Per test: how many mutants it kills, and how many only it kills.
//      A test that kills no mutant on its own is redundant for "can it fail".
import { readFileSync } from 'node:fs';

const [reportPath, filter] = process.argv.slice(2);
if (!reportPath) {
  console.error('Usage: node tools/mutation/summary.mjs <report.json> [source-file-filter]');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const files = Object.entries(report.files).filter(([path]) => !filter || path.includes(filter));
const short = (text, max) => text.replace(/\s+/g, ' ').trim().slice(0, max);

console.log('## Surviving mutants\n');
let survivors = 0;
for (const [path, file] of files) {
  const lines = file.source.split('\n');
  for (const m of file.mutants) {
    if (m.status !== 'Survived' && m.status !== 'NoCoverage') continue;
    survivors++;
    const line = m.location.start.line;
    const tag = m.status === 'NoCoverage' ? ' [no coverage]' : '';
    console.log(`${path}:${line}${tag} ${m.mutatorName}`);
    console.log(`  - ${short(lines[line - 1], 100)}`);
    console.log(`  + ${short(m.replacement ?? '', 100)}`);
  }
}
if (!survivors) console.log('None.');

// Test ids are only unique across the report, so map them to names first.
const testNames = new Map();
for (const [testFile, { tests }] of Object.entries(report.testFiles ?? {})) {
  for (const t of tests)
    testNames.set(t.id, `${testFile}:${t.location?.start.line ?? '?'} ${t.name}`);
}
const kills = new Map([...testNames.keys()].map((id) => [id, { total: 0, only: 0 }]));
for (const [, file] of files) {
  for (const m of file.mutants) {
    if (m.status !== 'Killed' || !m.killedBy) continue;
    for (const id of m.killedBy) kills.get(id).total++;
    if (m.killedBy.length === 1) kills.get(m.killedBy[0]).only++;
  }
}

console.log('\n## Mutants killed per test (total / only this test)\n');
const rows = [...kills.entries()]
  .filter(([id]) => !filter || testNames.get(id).includes(filter.replace(/\.ts$/, '')))
  .sort(([, a], [, b]) => a.only - b.only || a.total - b.total);
for (const [id, k] of rows) {
  const flag = k.only === 0 ? '  <- kills nothing alone' : '';
  console.log(
    `${String(k.total).padStart(4)} / ${String(k.only).padStart(3)}  ${testNames.get(id)}${flag}`,
  );
}
