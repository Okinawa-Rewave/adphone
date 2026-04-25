import { LocalDB }         from './services/localDB'
import { handleReceive, ReceiveResult }   from './services/receiveHandler'
import { computeScores }   from './services/scoreEngine'
import type { RawPacket }  from './types/RawPacket'
import type { ScoredEvent } from './types/ScoredEvent'
import type { VerifyFn }   from './types/ExternalFns'

export class TrustMapEngine {
  private db       = new LocalDB()
  private verifyFn: VerifyFn

  constructor(verifyFn: VerifyFn) {
    this.verifyFn = verifyFn
  }

  // LoRaでパケットを受信したときに呼ぶ
  async onReceive(packet: RawPacket): Promise<ReceiveResult> {
    return handleReceive(packet, this.db, this.verifyFn)
  }

  // 自分の観測を記録してブロードキャスト用パケットを返す
  recordObservation(
    params:    Omit<RawPacket, 'id' | 'timestamp'>,
    signature: string,
    opts?:     { id?: string; timestamp?: number }
  ): RawPacket {
    const packet: RawPacket = {
      ...params,
      id:        opts?.id ?? Math.random().toString(36).slice(2, 10),
      timestamp: opts?.timestamp ?? Math.floor(Date.now() / 1000),
      signature,
    }
    this.db.save(packet)
    return packet
  }

  // スコア計算（地図UIが呼ぶ）
  computeScores(myLat: number, myLng: number): ScoredEvent[] {
    return computeScores(this.db.getAll(), myLat, myLng)
  }
}

export type { RawPacket, Category }  from './types/RawPacket'
export type { ScoredEvent }          from './types/ScoredEvent'
export type { VerifyFn }             from './types/ExternalFns'
export type { ReceiveResult }        from './services/receiveHandler'
export { toStars }                   from './services/scoreEngine'
