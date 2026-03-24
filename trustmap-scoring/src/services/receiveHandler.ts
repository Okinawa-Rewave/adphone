import type { RawPacket } from '../types/RawPacket'
import type { VerifyFn }  from '../types/ExternalFns'
import { LocalDB }        from './localDB'
import { detectOutlier }  from './outlier'

export type ReceiveResult =
  | 'saved'         // 正常保存
  | 'duplicate'     // 受信済み
  | 'invalid_sig'   // 署名エラー
  | 'outlier'       // 異常パケット

// 署名対象のバイト列を生成（Android側のverifyFnに渡す形式）
export function toSignableBytes(p: RawPacket): Uint8Array {
  const obj = {
    id:        p.id,
    category:  p.category,
    severity:  p.severity,
    lat:       p.lat,
    lng:       p.lng,
    timestamp: p.timestamp,
    note:      p.note ?? '',
  }
  // キーをソートしてJSON化（Android側と順序を揃えるため）
  const sorted = Object.fromEntries(Object.entries(obj).sort())
  return new TextEncoder().encode(JSON.stringify(sorted))
}

export async function handleReceive(
  packet:   RawPacket,
  db:       LocalDB,
  verifyFn: VerifyFn
): Promise<ReceiveResult> {

  // Step1: 重複チェック
  if (db.isDuplicate(packet.id)) return 'duplicate'

  // Step2: 署名検証（Ed25519はAndroid側が実装・ここでは関数を呼ぶだけ）
  const payload = toSignableBytes(packet)
  const valid   = await verifyFn(packet.pubkey, payload, packet.signature)
  if (!valid) return 'invalid_sig'

  // Step3: 外れ値チェック
  if (detectOutlier(packet) !== null) return 'outlier'

  // Step4: 保存
  db.save(packet)
  return 'saved'
}