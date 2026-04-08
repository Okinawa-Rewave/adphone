import type { RawPacket }   from '../types/RawPacket'
import type { ScoredEvent } from '../types/ScoredEvent'
import { cluster }          from './clusterEngine'
import { decay }            from '../utils/decay'
import { UserTrustDB }      from './userTrustDB'

export function toStars(score: number): 1 | 2 | 3 {
  if (score >= 50) return 3
  if (score >= 10) return 2
  return 1
}

function aggregate(packets: RawPacket[]): { lat: number; lng: number; severity: number } {
  const n = packets.length
  return {
    lat:      packets.reduce((s, p) => s + p.lat,      0) / n,
    lng:      packets.reduce((s, p) => s + p.lng,      0) / n,
    severity: packets.reduce((s, p) => s + p.severity, 0) / n,
  }
}

// ── スコア計算 ────────────────────────────────────
// Score = Σ( decay(t) × userTrust(pubkey) )
function calcClusterScore(packets: RawPacket[], trustDB: UserTrustDB): number {
  return packets.reduce((sum, p) => {
    const trust = trustDB.getScore(p.pubkey, p.issuerType)
    return sum + decay(p.timestamp) * trust
  }, 0)
}

export function computeScores(
  allPackets: RawPacket[],
  _myLat:    number,
  _myLng:    number,
  trustDB:   UserTrustDB,
): ScoredEvent[] {
  if (allPackets.length === 0) return []

  const clusters = cluster(allPackets)

  return clusters
    .map((c) => {
      const score       = calcClusterScore(c.packets, trustDB)
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
