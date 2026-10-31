import type { BundleSize } from '@my-resume/api-models';
import type { AngularProjectJson, EsbuildMetafile } from './inputs.ts';

/** Angular's initial script entries (`main`, `polyfills`); the output name is the entry name plus an optional hash. */
const INITIAL_SCRIPT_ENTRIES = new Set(['main', 'polyfills']);
const GLOBAL_STYLES_ENTRY = 'angular:styles/global:';
/** Static imports load with their importer: `import` statements and CSS `@import` rules. */
const STATIC_IMPORT_KINDS = new Set(['import-statement', 'import-rule']);

function entryName(outputPath: string): string {
  const fileName = outputPath.slice(outputPath.lastIndexOf('/') + 1);
  // Same rule as @angular/build's bundler context: "main-7S5G3MDY.js" → "main".
  return fileName.replace(/(?:-[\dA-Z]{8})?\.[a-z]{2,3}$/, '');
}

function isBundleFile(path: string): boolean {
  return path.endsWith('.js') || path.endsWith('.css');
}

/**
 * esbuild metafile → raw sizes, as Angular counts its "initial" budget: the entry outputs (main, polyfills)
 * and the global styles, plus everything they import statically. Every other JS/CSS output is lazy.
 * Source maps and component stylesheets (inlined into the JS) don't count.
 */
export function bundleSizesFromMetafile(
  metafile: EsbuildMetafile,
): Pick<BundleSize, 'initialBytes' | 'lazyBytes'> {
  const outputs = Object.entries(metafile.outputs).filter(
    ([path, output]) => isBundleFile(path) && !output['ng-component'],
  );

  const toVisit = outputs
    .filter(
      ([path, output]) =>
        output.entryPoint !== undefined &&
        (INITIAL_SCRIPT_ENTRIES.has(entryName(path)) ||
          output.entryPoint.startsWith(GLOBAL_STYLES_ENTRY)),
    )
    .map(([path]) => path);
  const initial = new Set<string>(toVisit);
  for (let path = toVisit.pop(); path !== undefined; path = toVisit.pop()) {
    for (const imported of metafile.outputs[path]?.imports ?? []) {
      if (
        STATIC_IMPORT_KINDS.has(imported.kind) &&
        !imported.external &&
        !initial.has(imported.path)
      ) {
        initial.add(imported.path);
        toVisit.push(imported.path);
      }
    }
  }

  let initialBytes = 0;
  let lazyBytes = 0;
  for (const [path, output] of outputs) {
    if (initial.has(path)) {
      initialBytes += output.bytes;
    } else {
      lazyBytes += output.bytes;
    }
  }
  return { initialBytes, lazyBytes };
}

const BYTES_IN_KILOBYTE = 1000;
const UNIT_FACTORS: Record<string, number> = {
  b: 1,
  kb: BYTES_IN_KILOBYTE,
  mb: BYTES_IN_KILOBYTE ** 2,
  gb: BYTES_IN_KILOBYTE ** 3,
};

/**
 * An Angular budget value → bytes, like `calculateBytes` in @angular/build's bundle-calculator:
 * `500kb`, `1mb`, `300b`, `1234` (bytes) or `10%` (of the baseline); added to the baseline when there is one.
 */
export function parseBudgetBytes(value: string | undefined, baseline?: string): number | null {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)[ \t]*(%|[kmg]?b)?$/i);
  if (!match) {
    return null;
  }
  const baselineBytes = (baseline && parseBudgetBytes(baseline)) || 0;
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const bytes =
    unit === '%' ? (baselineBytes * amount) / 100 : amount * (unit ? (UNIT_FACTORS[unit] ?? 1) : 1);
  return Math.round(baselineBytes + bytes);
}

/** The "initial" budget of `apps/frontend/project.json`'s production build. */
export function initialBudgetFromProject(
  project: AngularProjectJson | null,
): Pick<BundleSize, 'budgetWarningBytes' | 'budgetErrorBytes'> {
  const budget = project?.targets?.build?.configurations?.production?.budgets?.find(
    (b) => b.type === 'initial',
  );
  return {
    budgetWarningBytes: parseBudgetBytes(budget?.maximumWarning, budget?.baseline),
    budgetErrorBytes: parseBudgetBytes(budget?.maximumError, budget?.baseline),
  };
}
