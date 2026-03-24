import type { RawPacket } from '../types/RawPacket'
import { haversineKm } from '../utils/haversine'

export const CLUSTER_PARAMS = {
  radiusM:           100,  // 同一事象と判定する座標半径（メートル）
  severityTolerance:  1,  // severity の許容差
}

export interface Cluster {
  category: RawPacket['category']
  packets:  RawPacket[]
}

// 2つのパケットが同一事象かどうか判定
export function isSameEvent(a: RawPacket, b: RawPacket): boolean {
  if (a.category !== b.category) return false

  const distM = haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000
  if (distM > CLUSTER_PARAMS.radiusM) return false

  if (Math.abs(a.severity - b.severity) > CLUSTER_PARAMS.severityTolerance) return false

  return true
}

// パケット群を同一事象ごとにグループ化
export function cluster(packets: RawPacket[]): Cluster[] {
  const clusters: Cluster[] = []

  for (const packet of packets) {
    const found = clusters.find((c) =>
      c.packets.some((p) => isSameEvent(packet, p))
    )

    if (found) {
      found.packets.push(packet)
    } else {
      clusters.push({ category: packet.category, packets: [packet] })
    }
  }

  return clusters
}