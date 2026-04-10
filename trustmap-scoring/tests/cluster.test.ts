import { describe, it, expect } from 'vitest'
import { cluster, isSameEvent } from '../src/services/clusterEngine'
import type { RawPacket } from '../src/types/RawPacket'

const makePacket = (o: Partial<RawPacket> = {}): RawPacket => ({
  id:         'test01',
  category:   'flood',
  severity:   3,
  issuerType: 0,
  lat:        35.689,
  lng:        139.691,
  timestamp:  Date.now() / 1000,
  pubkey:     'pk',
  signature:  'sig',
  ...o,
})

describe('isSameEvent', () => {
  it('全条件一致 → true', () => {
    expect(isSameEvent(makePacket(), makePacket({ id: 'test02' }))).toBe(true)
  })
  it('カテゴリが違う → false', () => {
    expect(isSameEvent(makePacket({ category: 'flood' }), makePacket({ category: 'fire' }))).toBe(false)
  })
  it('200m離れている → false', () => {
    expect(isSameEvent(makePacket(), makePacket({ lat: 35.691 }))).toBe(false)
  })
  it('severity差が2 → false', () => {
    expect(isSameEvent(makePacket({ severity: 1 }), makePacket({ severity: 3 }))).toBe(false)
  })
  it('severity差が1 → true', () => {
    expect(isSameEvent(makePacket({ severity: 2 }), makePacket({ severity: 3 }))).toBe(true)
  })
})

describe('cluster', () => {
  it('パケットが0件 → クラスター0件', () => {
    expect(cluster([])).toHaveLength(0)
  })
  it('同一事象3件 → クラスター1件・パケット3つ', () => {
    const result = cluster([
      makePacket({ id: 'a' }),
      makePacket({ id: 'b' }),
      makePacket({ id: 'c' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].packets).toHaveLength(3)
  })
  it('カテゴリが違う2件 → クラスター2件', () => {
    expect(cluster([
      makePacket({ id: 'a', category: 'flood' }),
      makePacket({ id: 'b', category: 'fire' }),
    ])).toHaveLength(2)
  })
  it('離れた場所の同カテゴリ2件 → クラスター2件', () => {
    expect(cluster([
      makePacket({ id: 'a', lat: 35.689 }),
      makePacket({ id: 'b', lat: 35.710 }),
    ])).toHaveLength(2)
  })
  it('flood2件・fire1件 → クラスター2件', () => {
    const result = cluster([
      makePacket({ id: 'a', category: 'flood' }),
      makePacket({ id: 'b', category: 'flood' }),
      makePacket({ id: 'c', category: 'fire'  }),
    ])
    expect(result).toHaveLength(2)
    expect(result.find(c => c.category === 'flood')?.packets).toHaveLength(2)
  })
})
