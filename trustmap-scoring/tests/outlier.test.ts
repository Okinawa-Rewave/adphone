import { describe, it, expect } from 'vitest'
import { detectOutlier } from '../src/services/outlier'
import type { RawPacket } from '../src/types/RawPacket'

const NOW = Math.floor(Date.now() / 1000)

const makePacket = (timestamp: number): RawPacket => ({
  id: 'p01', category: 'flood', severity: 3,
  lat: 35.689, lng: 139.691,
  timestamp, pubkey: 'pk', signature: 'sig',
})

describe('detectOutlier', () => {
  it('正常なタイムスタンプ → null', () => {
    expect(detectOutlier(makePacket(NOW))).toBe(null)
  })

  it('4時間前 → too_old', () => {
    expect(detectOutlier(makePacket(NOW - 4 * 3600))).toBe('too_old')
  })

  it('3時間以内 → null（ギリギリOK）', () => {
    expect(detectOutlier(makePacket(NOW - 3 * 3600 + 10))).toBe(null)
  })

  it('10分後の未来 → future_timestamp', () => {
    expect(detectOutlier(makePacket(NOW + 600))).toBe('future_timestamp')
  })

  it('4分後の未来 → null（クロックスキュー許容範囲内）', () => {
    expect(detectOutlier(makePacket(NOW + 240))).toBe(null)
  })
})