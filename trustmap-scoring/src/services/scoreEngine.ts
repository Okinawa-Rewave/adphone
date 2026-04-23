import type { RawPacket }   from '../types/RawPacket'
import type { ScoredEvent } from '../types/ScoredEvent'
import { cluster }          from './clusterEngine'
import { decay }            from '../utils/decay'

const OFFICIAL_WEIGHT = 5.0

/**
 * 発行者の重みを計算する。
 * - 公式（issuerType=1）は固定 5.0
 * - 一般ユーザーは userTrustScore（0-100）に基づき 0.5〜2.0 でスケール
 *   score=50（デフォルト）→ 1.0、score=100 → 2.0、score=0 → 0.5
 */
function issuerWeight(issuerType: number, userTrustScore?: number): number {
  if (issuerType === 1) return OFFICIAL_WEIGHT
  const t = (userTrustScore ?? 50) / 100
  return 0.5 + t * 1.5
}

export function toStars(score: number): 1 | 2 | 3 {
  if (score >= 50) return 3
  if (score >= 10) return 2
  return 1
}

function calcClusterScore(packets: RawPacket[]): number {
  return packets.reduce((sum, p) => {
    const userScore = (p as any).userTrustScore as number | undefined
    return sum + decay(p.timestamp) * issuerWeight(p.issuerType, userScore)
  }, 0)
}

function aggregate(packets: RawPacket[]): { lat: number; lng: number; severity: number } {
  const n = packets.length
  return {
    lat:      packets.reduce((s, p) => s + p.lat,      0) / n,
    lng:      packets.reduce((s, p) => s + p.lng,      0) / n,
    severity: packets.reduce((s, p) => s + p.severity, 0) / n,
  }
}

export function computeScores(
  allPackets: RawPacket[],
  _myLat:    number,
  _myLng:    number
): ScoredEvent[] {
  if (allPackets.length === 0) return []

  const clusters = cluster(allPackets)

  return clusters
    .map((c) => {
      const score       = calcClusterScore(c.packets)
      const agg         = aggregate(c.packets)
      const hasOfficial = c.packets.some(p => p.issuerType === 1)

      return {
        category:     c.category,
        lat:          agg.lat,
        lng:          agg.lng,
        severity:     agg.severity,
        score,
        stars:        toStars(score),
        witnessCount: c.packets.length,
        hasOfficial,
        packets:      c.packets,
        computedAt:   Math.floor(Date.now() / 1000),
      } satisfies ScoredEvent
    })
    .sort((a, b) => b.score - a.score)
}
