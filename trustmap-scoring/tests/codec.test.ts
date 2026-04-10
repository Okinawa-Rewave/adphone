import { describe, it, expect } from 'vitest'
import { encodePacket, decodePacket } from '../src/utils/codec'
import type { RawPacket } from '../src/types/RawPacket'

const makePacket = (o: Partial<RawPacket> = {}): RawPacket => ({
  id:         'a3f8c2d1',
  category:   'flood',
  severity:   3,
  issuerType: 0,
  lat:        35.6894,
  lng:        139.6917,
  timestamp:  1720000000,
  pubkey:     'pk',
  signature:  'sig',
  ...o,
})

describe('codec', () => {
  it('エンコード→デコードで元に戻る', () => {
    const original = makePacket()
    const encoded  = encodePacket(original)
    const decoded  = decodePacket(encoded, 'pk', 'sig')
    expect(decoded?.category).toBe(original.category)
    expect(decoded?.severity).toBe(original.severity)
    expect(decoded?.issuerType).toBe(original.issuerType)
    expect(decoded?.lat).toBeCloseTo(original.lat, 3)
    expect(decoded?.lng).toBeCloseTo(original.lng, 3)
    expect(decoded?.timestamp).toBe(original.timestamp)
  })

  it('issuerType=1がエンコード→デコードで保持される', () => {
    const original = makePacket({ issuerType: 1 })
    const decoded  = decodePacket(encodePacket(original), 'pk', 'sig')
    expect(decoded?.issuerType).toBe(1)
  })

  it('note付きでエンコード→デコード', () => {
    const original = makePacket({ note: '地下道が浸水' })
    const decoded  = decodePacket(encodePacket(original), 'pk', 'sig')
    expect(decoded?.note).toBe('地下道が浸水')
  })

  it('note省略時は最小19バイト', () => {
    expect(encodePacket(makePacket()).length).toBe(19)
  })

  it('全カテゴリが正しく変換される', () => {
    const categories = [
      'flood', 'fire', 'road_block', 'building_collapse',
      'tsunami', 'landslide', 'gas_leak', 'danger', 'injured'
    ] as const
    for (const category of categories) {
      const decoded = decodePacket(encodePacket(makePacket({ category })), 'pk', 'sig')
      expect(decoded?.category).toBe(category)
    }
  })

  it('不正なカテゴリバイトはnullを返す', () => {
    const encoded = encodePacket(makePacket())
    encoded[4] = 0xFF
    expect(decodePacket(encoded, 'pk', 'sig')).toBeNull()
  })

  it('短すぎるバイト列はnullを返す', () => {
    expect(decodePacket(new Uint8Array(10), 'pk', 'sig')).toBeNull()
  })

  it('injuredカテゴリが正しく変換される', () => {
    const original = makePacket({ category: 'injured' })
    const decoded  = decodePacket(encodePacket(original), 'pk', 'sig')
    expect(decoded?.category).toBe('injured')
  })
})
