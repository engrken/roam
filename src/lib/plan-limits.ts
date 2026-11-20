export function isPlanLimitReached(limit: number | null | undefined, currentCount: number) {
  return limit !== null && limit !== undefined && currentCount >= limit;
}
