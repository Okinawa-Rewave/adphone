const HALF_LIFE_DAY_SEC   = 3600      // 昼間: 1時間
const HALF_LIFE_NIGHT_SEC = 3 * 3600  // 夜間: 3時間

const NIGHT_START_HOUR = 22  // 22:00 から夜間
const NIGHT_END_HOUR   = 6   // 06:00 まで夜間

function isNight(nowMs: number): boolean {
  const h = new Date(nowMs).getHours()
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR
}

export function decay(timestampSec: number): number {
  const nowMs      = Date.now()
  const elapsed    = nowMs / 1000 - timestampSec
  const halfLife   = isNight(nowMs) ? HALF_LIFE_NIGHT_SEC : HALF_LIFE_DAY_SEC
  const lambda     = Math.LN2 / halfLife
  return Math.exp(-lambda * Math.max(elapsed, 0))
}
