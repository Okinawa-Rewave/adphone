import type { RawPacket }  from '../types/RawPacket'
import type { VerifyFn }   from '../types/ExternalFns'
import { LocalDB }         from './localDB'
import { UserTrustDB }     from './userTrustDB'
import { checkOutlier }    from './outlier'
import { cluster }         from './clusterEngine'

export type ReceiveResult = 'saved' | 'duplicate' | 'invalid_sig' | 'outlier'

export async function handleReceive(
  packet:  RawPacket,
  verifyFn: VerifyFn,
  db:       LocalDB,
  trustDB:  UserTrustDB,
): Promise<ReceiveResult> {

  // 1. 重複チェック
  if (db.has(packet.id)) return 'duplicate'

  // 2. 外れ値チェック
  if (checkOutlier(packet) !== 'ok') return 'outlier'

  // 3. 署名検証
  const payload = new TextEncoder().encode(
    `${packet.id}${packet.category}${packet.severity}${packet.lat}${packet.lng}${packet.timestamp}`
  )
  const valid = await verifyFn(packet.pubkey, payload, packet.signature)
  if (!valid) return 'invalid_sig'

  // 4. 保存
  db.save(packet)

  // 5. ユーザー信頼スコアの更新
  trustDB.recordPacket(packet)

  // 6. 裏付けチェック
  // 保存後に全パケットを見て、同じクラスターに別のユーザーがいればUP
  const allPackets = db.getAll()
  const clusters   = cluster(allPackets)

  for (const c of clusters) {
    const inCluster = c.packets.some(p => p.id === packet.id)
    if (!inCluster) continue

    // 同じクラスターに自分以外のパケットがある
    const others = c.packets.filter(p => p.pubkey !== packet.pubkey)
    if (others.length === 0) continue

    // 公的機関が同じクラスターにいるか
    const byOfficial = others.some(p => p.issuerType === 1)

    // 同じクラスターにいる全員の信頼度をUP
    const uniquePubkeys = [...new Set(c.packets.map(p => p.pubkey))]
    for (const pk of uniquePubkeys) {
      trustDB.corroborate(pk, byOfficial)
    }
  }

  return 'saved'
}
