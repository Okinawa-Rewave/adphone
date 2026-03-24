import type { RawPacket } from '../types/RawPacket'

const MAX_AGE_SEC = 3 * 3600  // 3時間以上前は破棄

export type OutlierReason =
  | 'too_old'           // 古すぎる
  | 'future_timestamp'  // 未来のタイムスタンプ
  | null                // 正常

export function detectOutlier(packet: RawPacket): OutlierReason {
  const now = Math.floor(Date.now() / 1000)

  if (now - packet.timestamp > MAX_AGE_SEC) return 'too_old'
  if (packet.timestamp > now + 300)         return 'future_timestamp'

  return null
}