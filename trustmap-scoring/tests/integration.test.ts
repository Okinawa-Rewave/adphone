import { describe, it, expect, vi } from 'vitest'
import { TrustMapEngine } from '../src/index'
import type { RawPacket } from '../src/types/RawPacket'

const NOW    = Math.floor(Date.now() / 1000)
const MY_LAT = 35.689
const MY_LNG = 139.691

const alwaysValid   = vi.fn().mockResolvedValue(true)
const alwaysInvalid = vi.fn().mockResolvedValue(false)

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

describe('TrustMapEngine 統合テスト', () => {
  it('正常なパケットを受信 → saved', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    expect(await engine.onReceive(makePacket())).toBe('saved')
  })

  it('同じパケットを2回受信 → 2回目はduplicate', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    await engine.onReceive(makePacket({ id: 'dup01' }))
    expect(await engine.onReceive(makePacket({ id: 'dup01' }))).toBe('duplicate')
  })

  it('署名エラーのパケット → invalid_sig', async () => {
    const engine = new TrustMapEngine(alwaysInvalid)
    expect(await engine.onReceive(makePacket())).toBe('invalid_sig')
  })

  it('古いパケット → outlier', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    expect(await engine.onReceive(makePacket({ timestamp: NOW - 4 * 3600 }))).toBe('outlier')
  })

  it('3件受信後にcomputeScores → ScoredEvent 1件', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    await engine.onReceive(makePacket({ id: 'a' }))
    await engine.onReceive(makePacket({ id: 'b' }))
    await engine.onReceive(makePacket({ id: 'c' }))
    const events = engine.computeScores(MY_LAT, MY_LNG)
    expect(events).toHaveLength(1)
    expect(events[0].witnessCount).toBe(3)
  })

  it('flood2件・fire1件受信 → ScoredEvent 2件', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    await engine.onReceive(makePacket({ id: 'a', category: 'flood' }))
    await engine.onReceive(makePacket({ id: 'b', category: 'flood' }))
    await engine.onReceive(makePacket({ id: 'c', category: 'fire'  }))
    expect(engine.computeScores(MY_LAT, MY_LNG)).toHaveLength(2)
  })

  it('recordObservation → computeScoresに反映される', () => {
    const engine = new TrustMapEngine(alwaysValid)
    engine.recordObservation({
      category: 'danger', severity: 4,
      issuerType: 0,
      lat: MY_LAT, lng: MY_LNG,
      pubkey: 'mypk', signature: 'mysig',
    }, 'mysig')
    expect(engine.computeScores(MY_LAT, MY_LNG)[0].category).toBe('danger')
  })

  it('公的機関パケット → hasOfficialがtrue', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    await engine.onReceive(makePacket({ issuerType: 1 }))
    expect(engine.computeScores(MY_LAT, MY_LNG)[0].hasOfficial).toBe(true)
  })
})
