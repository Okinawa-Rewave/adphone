import { describe, it, expect, vi } from 'vitest'
import { TrustMapEngine }   from '../src/index'
import { TRUST_INITIAL, TRUST_OFFICIAL, TRUST_MIN } from '../src/services/userTrustDB'
import type { RawPacket }   from '../src/types/RawPacket'

const NOW    = Math.floor(Date.now() / 1000)
const MY_LAT = 35.689
const MY_LNG = 139.691

const alwaysValid = vi.fn().mockResolvedValue(true)

const makePacket = (o: Partial<RawPacket> = {}): RawPacket => ({
  id:         'p01',
  category:   'flood',
  severity:   3,
  issuerType: 0,
  lat:        MY_LAT,
  lng:        MY_LNG,
  timestamp:  NOW,
  pubkey:     'user-a',
  signature:  'sig',
  ...o,
})

describe('UserTrustDB', () => {
  it('新規ユーザーの初期スコアは1.0', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    await engine.onReceive(makePacket({ pubkey: 'newuser' }))
    const scores = engine.getUserTrustScores()
    // 初回送信だけではスコアは初期値のまま
    expect(scores.get('newuser') ?? TRUST_INITIAL).toBe(TRUST_INITIAL)
  })

  it('公的機関のスコアは常に5.0', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    await engine.onReceive(makePacket({ pubkey: 'gov-a', issuerType: 1 }))
    // 公的機関はUserTrustDBに記録されない（固定値）
    const scores = engine.getUserTrustScores()
    expect(scores.has('gov-a')).toBe(false)
  })

  it('別のユーザーが同じ場所を報告すると信頼スコアがUP', async () => {
    const engine = new TrustMapEngine(alwaysValid)
    await engine.onReceive(makePacket({ id: 'p01', pubkey: 'user-a' }))
    await engine.onReceive(makePacket({ id: 'p02', pubkey: 'user-b' }))

    const scores = engine.getUserTrustScores()
    // 裏付けが取れたのでuser-aのスコアが上がっているはず
    expect((scores.get('user-a') ?? TRUST_INITIAL)).toBeGreaterThan(TRUST_INITIAL)
  })

  it('公的機関が同じ情報を確認するとスコアが大きくUP', async () => {
    const engineA = new TrustMapEngine(alwaysValid)
    const engineB = new TrustMapEngine(alwaysValid)

    // engineA: 一般ユーザー + 一般ユーザーの裏付け
    await engineA.onReceive(makePacket({ id: 'p01', pubkey: 'user-a' }))
    await engineA.onReceive(makePacket({ id: 'p02', pubkey: 'user-b' }))

    // engineB: 一般ユーザー + 公的機関の裏付け
    await engineB.onReceive(makePacket({ id: 'p01', pubkey: 'user-a' }))
    await engineB.onReceive(makePacket({ id: 'p03', pubkey: 'gov-x', issuerType: 1 }))

    const scoresA = engineA.getUserTrustScores()
    const scoresB = engineB.getUserTrustScores()

    // 公的機関に裏付けられた方がスコアが高い
    expect((scoresB.get('user-a') ?? TRUST_INITIAL))
      .toBeGreaterThan(scoresA.get('user-a') ?? TRUST_INITIAL)
  })

  it('1時間以内に5件以上送信するとスパム判定でスコアDOWN', async () => {
    const engine = new TrustMapEngine(alwaysValid)

    // 5件送信（同一pubkey・1時間以内）
    for (let i = 0; i < 5; i++) {
      await engine.onReceive(makePacket({
        id:        `spam-${i}`,
        pubkey:    'spammer',
        lat:       MY_LAT + i * 0.001,  // 少しずつ位置をずらしてduplicateを避ける
        timestamp: NOW - i * 60,
      }))
    }

    const scores = engine.getUserTrustScores()
    // スパム判定でスコアが下がっているはず
    expect((scores.get('spammer') ?? TRUST_INITIAL)).toBeLessThan(TRUST_INITIAL)
  })

  it('スコアが下がっても最小値0.1を下回らない', async () => {
    const engine = new TrustMapEngine(alwaysValid)

    // 大量送信でスコアを下げる
    for (let i = 0; i < 30; i++) {
      await engine.onReceive(makePacket({
        id:        `spam2-${i}`,
        pubkey:    'heavy-spammer',
        lat:       MY_LAT + i * 0.001,
        timestamp: NOW - i * 10,
      }))
    }

    const scores = engine.getUserTrustScores()
    expect((scores.get('heavy-spammer') ?? TRUST_INITIAL)).toBeGreaterThanOrEqual(TRUST_MIN)
  })

  it('信頼スコアが高いユーザーの情報は計算スコアが高い', async () => {
    const engineLow  = new TrustMapEngine(alwaysValid)
    const engineHigh = new TrustMapEngine(alwaysValid)

    // engineLow: 信頼度1.0のユーザー1人
    await engineLow.onReceive(makePacket({ id: 'p01', pubkey: 'low-trust' }))

    // engineHigh: 同じユーザーが複数から裏付けられて信頼度UP
    await engineHigh.onReceive(makePacket({ id: 'p01', pubkey: 'high-trust' }))
    await engineHigh.onReceive(makePacket({ id: 'p02', pubkey: 'other-user' }))
    await engineHigh.onReceive(makePacket({ id: 'p03', pubkey: 'gov', issuerType: 1 }))

    const eventsLow  = engineLow.computeScores(MY_LAT, MY_LNG)
    const eventsHigh = engineHigh.computeScores(MY_LAT, MY_LNG)

    expect(eventsHigh[0].score).toBeGreaterThan(eventsLow[0].score)
  })
})
