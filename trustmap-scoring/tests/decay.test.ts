import { describe, it, expect } from 'vitest'
import { decay } from '../src/utils/decay'

describe('decay', () => {
  it('発信直後は1.0に近い', () => {
    const now = Date.now() / 1000
    expect(decay(now)).toBeCloseTo(1.0, 2)
  })

  it('1時間後は約0.5', () => {
    const oneHourAgo = Date.now() / 1000 - 3600
    expect(decay(oneHourAgo)).toBeCloseTo(0.5, 1)
  })

  it('2時間後は約0.25', () => {
    const twoHoursAgo = Date.now() / 1000 - 7200
    expect(decay(twoHoursAgo)).toBeCloseTo(0.25, 1)
  })

  it('未来のタイムスタンプでも1.0を返す', () => {
    const future = Date.now() / 1000 + 9999
    expect(decay(future)).toBeCloseTo(1.0, 2)
  })
})
