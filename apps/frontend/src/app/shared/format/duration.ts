/** `372` → `6 min 12 s`, `3900` → `1 h 5 min`. Zero parts are left out. */
export function formatDuration(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts =
    hours > 0
      ? [`${hours} h`, minutes > 0 ? `${minutes} min` : '']
      : minutes > 0
        ? [`${minutes} min`, seconds > 0 ? `${seconds} s` : '']
        : [`${seconds} s`];
  return parts.filter(Boolean).join(' ');
}
