# quality-report

Assembles the Quality report (`QualityReport` from `@my-resume/api-models`, served by `GET /api/quality`) from the build pipeline's raw outputs: Vitest JSON results and istanbul coverage summaries (`coverage/<project>/`, `coverage/integration/<project>/`), the frontend's esbuild stats, the Nx project graph and the GitHub Actions run timings.

- `src/lib/`: pure functions (no file access, `now` passed in), unit-tested with the fixtures in `src/lib/fixtures/`.
- `src/cli.ts`: reads the files and writes the report. It runs with Node's built-in type stripping, so it only uses erasable TypeScript, `import type` for types and `.ts` extensions on relative imports.

```bash
npx nx graph --file=dist/quality-report/nx-graph.json
npx nx run quality-report:assemble --nx-graph=dist/quality-report/nx-graph.json   # see src/cli.ts for the options
npx nx test quality-report
```

CI usage and the local flow: [docs/deployment.md](../../docs/deployment.md#quality-report).
