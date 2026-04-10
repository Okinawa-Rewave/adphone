import { describe, it, expect } from 'vitest'
import { haversineKm } from '../src/utils/haversine'

describe('haversineKm', () => {
  it('同じ地点なら0を返す', () => {
    expect(haversineKm(35.689, 139.691, 35.689, 139.691)).toBe(0)
  })

  it('東京→大阪は約400km', () => {
    const km = haversineKm(35.689, 139.691, 34.693, 135.502)
    expect(km).toBeGreaterThan(390)
    expect(km).toBeLessThan(410)
  })

  it('50m離れた地点は0.05km以下', () => {
    const km = haversineKm(35.689, 139.691, 35.6894, 139.691)
    expect(km).toBeLessThan(0.05)
  })
})
