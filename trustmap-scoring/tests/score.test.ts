import { describe, it, expect } from 'vitest'
import { computeScores, toStars } from '../src/services/scoreEngine'
import type { RawPacket } from '../src/types/RawPacket'

const NOW    = Math.floor(Date.now() / 1000)
const MY_LAT = 35.689
const MY_LNG = 139.691

const makePacket = (o: Partial<RawPacket> = {}): RawPacket => ({
  id:         'p01',
  category:   'flood',
  severity:   3,
  issuerType: 0,
  lat:        MY_LAT,
  lng:        MY_LNG,
  timestamp:  NOW,
  pubkey:     'pk',
  signature:  'sig',
  ...o,
})

describe('toStars', () => {
  it('score 50以上 → ★★★', () => {
    expect(toStars(50)).toBe(3)
    expect(toStars(100)).toBe(3)
  })
  it('score 10〜49 → ★★☆', () => {
    expect(toStars(10)).toBe(2)
    expect(toStars(49)).toBe(2)
  })
  it('score 9以下 → ★☆☆', () => {
    expect(toStars(9)).toBe(1)
    expect(toStars(0)).toBe(1)
  })
})

describe('computeScores', () => {
  it('パケット0件 → 空配列', () => {
    expect(computeScores([], MY_LAT, MY_LNG)).toHaveLength(0)
  })

  it('1件の観測 → ScoredEvent 1件', () => {
    const result = computeScores([makePacket()], MY_LAT, MY_LNG)
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('flood')
    expect(result[0].witnessCount).toBe(1)
  })

  it('同一事象3件 → witnessCount=3', () => {
    const packets = [
      makePacket({ id: 'a' }),
      makePacket({ id: 'b' }),
      makePacket({ id: 'c' }),
    ]
    const result = computeScores(packets, MY_LAT, MY_LNG)
    expect(result).toHaveLength(1)
    expect(result[0].witnessCount).toBe(3)
  })

  it('目撃者が多いほどスコアが高い', () => {
    const one   = computeScores([makePacket({ id: 'a' })], MY_LAT, MY_LNG)
    const three = computeScores([
      makePacket({ id: 'a' }),
      makePacket({ id: 'b' }),
      makePacket({ id: 'c' }),
    ], MY_LAT, MY_LNG)
    expect(three[0].score).toBeGreaterThan(one[0].score)
  })

  it('古い情報はスコアが低い', () => {
    const fresh = computeScores([makePacket({ timestamp: NOW })],          MY_LAT, MY_LNG)
    const stale = computeScores([makePacket({ timestamp: NOW - 7200 })],   MY_LAT, MY_LNG)
    expect(fresh[0].score).toBeGreaterThan(stale[0].score)
  })

  it('スコア降順にソートされている', () => {
    const packets = [
      makePacket({ id: 'a', category: 'fire',  timestamp: NOW - 7200 }),
      makePacket({ id: 'b', category: 'flood', timestamp: NOW }),
    ]
    const result = computeScores(packets, MY_LAT, MY_LNG)
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
  })

  it('flood2件・fire1件 → ScoredEvent 2件', () => {
    const packets = [
      makePacket({ id: 'a', category: 'flood' }),
      makePacket({ id: 'b', category: 'flood' }),
      makePacket({ id: 'c', category: 'fire'  }),
    ]
    const result = computeScores(packets, MY_LAT, MY_LNG)
    expect(result).toHaveLength(2)
  })

  it('公的機関確認ありはスコアが高い', () => {
    const normal   = computeScores([makePacket({ id: 'a', issuerType: 0 })], MY_LAT, MY_LNG)
    const official = computeScores([makePacket({ id: 'b', issuerType: 1 })], MY_LAT, MY_LNG)
    expect(official[0].score).toBeGreaterThan(normal[0].score)
  })

  it('公的機関確認済みフラグが立つ', () => {
    const result = computeScores([makePacket({ issuerType: 1 })], MY_LAT, MY_LNG)
    expect(result[0].hasOfficial).toBe(true)
  })

  it('一般ユーザーのみはhasOfficialがfalse', () => {
    const result = computeScores([makePacket({ issuerType: 0 })], MY_LAT, MY_LNG)
    expect(result[0].hasOfficial).toBe(false)
  })
})
