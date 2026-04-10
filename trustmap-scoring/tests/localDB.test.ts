import { describe, it, expect } from 'vitest'
import { LocalDB } from '../src/services/localDB'
import type { RawPacket } from '../src/types/RawPacket'

const makePacket = (id: string, timestamp = Date.now() / 1000): RawPacket => ({
  id, category: 'flood', severity: 3,
  issuerType: 0,
  lat: 35.689, lng: 139.691,
  timestamp, pubkey: 'pk', signature: 'sig',
})

describe('LocalDB', () => {
  it('save して getAll で取得できる', () => {
    const db = new LocalDB()
    db.save(makePacket('a'))
    expect(db.getAll()).toHaveLength(1)
  })

  it('同じidを2回saveしても1件のまま', () => {
    const db = new LocalDB()
    db.save(makePacket('a'))
    db.save(makePacket('a'))
    expect(db.getAll()).toHaveLength(1)
  })

  it('isDuplicate: 保存済みidはtrue', () => {
    const db = new LocalDB()
    db.save(makePacket('a'))
    expect(db.isDuplicate('a')).toBe(true)
  })

  it('isDuplicate: 未保存idはfalse', () => {
    const db = new LocalDB()
    expect(db.isDuplicate('unknown')).toBe(false)
  })

  it('clear後はgetAllが空になる', () => {
    const db = new LocalDB()
    db.save(makePacket('a'))
    db.clear()
    expect(db.getAll()).toHaveLength(0)
  })
})
