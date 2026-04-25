import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { decay } from '../src/utils/decay'

// 昼間 (12:00) に固定するヘルパー
function setNoon() {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  vi.setSystemTime(d)
}

// 夜間 (23:00) に固定するヘルパー
function setMidnight() {
  const d = new Date()
  d.setHours(23, 0, 0, 0)
  vi.setSystemTime(d)
}

describe('decay', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('発信直後は1.0に近い（昼間）', () => {
    setNoon()
    const now = Date.now() / 1000
    expect(decay(now)).toBeCloseTo(1.0, 2)
  })

  it('未来のタイムスタンプでも1.0を返す', () => {
    setNoon()
    const future = Date.now() / 1000 + 9999
    expect(decay(future)).toBeCloseTo(1.0, 2)
  })

  describe('昼間（半減期1時間）', () => {
    beforeEach(() => { setNoon() })

    it('1時間後は約0.5', () => {
      const oneHourAgo = Date.now() / 1000 - 3600
      expect(decay(oneHourAgo)).toBeCloseTo(0.5, 1)
    })

    it('2時間後は約0.25', () => {
      const twoHoursAgo = Date.now() / 1000 - 7200
      expect(decay(twoHoursAgo)).toBeCloseTo(0.25, 1)
    })
  })

  describe('夜間（半減期3時間）', () => {
    beforeEach(() => { setMidnight() })

    it('3時間後は約0.5', () => {
      const threeHoursAgo = Date.now() / 1000 - 3 * 3600
      expect(decay(threeHoursAgo)).toBeCloseTo(0.5, 1)
    })

    it('1時間後は約0.79（昼間より緩やか）', () => {
      const oneHourAgo = Date.now() / 1000 - 3600
      expect(decay(oneHourAgo)).toBeCloseTo(Math.pow(0.5, 1 / 3), 1)
    })
  })
})
