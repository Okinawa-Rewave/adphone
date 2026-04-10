const HALF_LIFE_SEC = 3600

export function decay(timestampSec: number): number {
  const elapsed = Date.now() / 1000 - timestampSec
  const lambda  = Math.LN2 / HALF_LIFE_SEC
  return Math.exp(-lambda * Math.max(elapsed, 0))
}
