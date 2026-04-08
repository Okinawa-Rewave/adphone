import { LocalDB }         from './services/localDB'
import { UserTrustDB }     from './services/userTrustDB'
import { handleReceive }   from './services/receiveHandler'
import { computeScores }   from './services/scoreEngine'
import type { VerifyFn }   from './types/ExternalFns'
import type { RawPacket }  from './types/RawPacket'
import type { ScoredEvent } from './types/ScoredEvent'

export type { RawPacket, ScoredEvent }
export type { VerifyFn }

export class TrustMapEngine {
  private db      = new LocalDB()
  private trustDB = new UserTrustDB()
  private verifyFn: VerifyFn

  constructor(verifyFn: VerifyFn) {
    this.verifyFn = verifyFn
  }

  async onReceive(packet: RawPacket): Promise<'saved' | 'duplicate' | 'invalid_sig' | 'outlier'> {
    return handleReceive(packet, this.verifyFn, this.db, this.trustDB)
  }

  recordObservation(
    params: Omit<RawPacket, 'id' | 'timestamp'>,
    signature: string,
  ): RawPacket {
    const packet: RawPacket = {
      ...params,
      id:        Math.random().toString(16).slice(2, 10),
      timestamp: Math.floor(Date.now() / 1000),
      signature,
    }
    this.db.save(packet)
    this.trustDB.recordPacket(packet)
    return packet
  }

  computeScores(myLat: number, myLng: number): ScoredEvent[] {
    return computeScores(this.db.getAll(), myLat, myLng, this.trustDB)
  }

  // デバッグ用: ユーザー信頼スコアを取得
  getUserTrustScores(): Map<string, number> {
    return this.trustDB.getAllScores()
  }
}
