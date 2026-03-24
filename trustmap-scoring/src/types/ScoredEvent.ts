import type { Category, RawPacket } from './RawPacket'

export interface ScoredEvent {
  category:     Category
  lat:          number
  lng:          number
  severity:     number
  score:        number
  stars:        1 | 2 | 3
  witnessCount: number
  hasOfficial:  boolean
  packets:      RawPacket[]
  computedAt:   number
}
