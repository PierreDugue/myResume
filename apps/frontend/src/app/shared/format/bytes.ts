/** `512340` → `512.3 kB`. 1 kB = 1000 bytes, the way Angular's budgets count. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const tenthsOfKb = Math.round(bytes / 100);
  if (tenthsOfKb < 10_000) return `${(tenthsOfKb / 10).toFixed(1)} kB`;
  return `${(Math.round(bytes / 100_000) / 10).toFixed(1)} MB`;
}
