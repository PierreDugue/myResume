/**
 * Fails when a source file is over the line limit (CLAUDE.md, "File size").
 *
 *   node tools/file-size/src/cli.ts            every file git knows about (tracked or new, not ignored)
 *   node tools/file-size/src/cli.ts <files...> only these files
 *   npx nx run file-size:check                 the same as the first; every build depends on it
 *
 * Runs with Node's built-in type stripping (no build step).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { checkFileSizes, countLines, formatReport, isChecked } from './lib/file-size.ts';

function gitFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return out.split('\0').filter(Boolean);
}

const args = process.argv.slice(2);
const paths = (args.length > 0 ? args : gitFiles()).filter((p) => isChecked(p) && existsSync(p));
const check = checkFileSizes(
  paths.map((path) => ({ path, lines: countLines(readFileSync(path, 'utf8')) })),
);
const report = formatReport(check);

if (check.tooBig.length > 0) {
  console.error(report);
  process.exit(1);
}
if (report) console.log(report);
console.log(`File size check passed (${paths.length} files).`);
