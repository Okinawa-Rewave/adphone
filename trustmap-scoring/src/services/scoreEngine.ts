import type { RawPacket }   from '../types/RawPacket'
import type { ScoredEvent } from '../types/ScoredEvent'
import { cluster }          from './clusterEngine'
import { decay }            from '../utils/decay'

const OFFICIAL_WEIGHT = 5.0
const NORMAL_WEIGHT   = 1.0

function issuerWeight(issuerType: number): number {
  return issuerType === 1 ? OFFICIAL_WEIGHT : NORMAL_WEIGHT
}

export function toStars(score: number): 1 | 2 | 3 {
  if (score >= 50) return 3
  if (score >= 10) return 2
  return 1
}

function calcClusterScore(packets: RawPacket[]): number {
  return packets.reduce((sum, p) => {
    return sum + decay(p.timestamp) * issuerWeight(p.issuerType)
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
