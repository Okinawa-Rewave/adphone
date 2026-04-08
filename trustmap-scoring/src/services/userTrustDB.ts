import type { RawPacket } from '../types/RawPacket'

// ── ユーザー信頼スコアの定数 ──────────────────────
export const TRUST_INITIAL   = 1.0   // 新規ユーザーの初期値
export const TRUST_OFFICIAL  = 5.0   // 公的機関（固定）
export const TRUST_MIN       = 0.1   // 最小値
export const TRUST_MAX       = 5.0   // 最大値

const TRUST_UP_CORROBORATE   = 0.2   // 裏付けが取れた
const TRUST_UP_OFFICIAL      = 0.5   // 公的機関が同じ情報を確認
const TRUST_DOWN_SPAM        = 0.5   // スパム検出

const SPAM_WINDOW_SEC        = 3600  // スパム判定の時間窓（1時間）
const SPAM_THRESHOLD         = 5     // この件数以上で スパム判定

// ── ユーザー信頼スコアのDB ────────────────────────
export class UserTrustDB {
  // pubkey → 信頼スコア
  private scores  = new Map<string, number>()
  // pubkey → 送信タイムスタンプの配列（スパム検出用）
  private history = new Map<string, number[]>()

  // ── スコアの取得 ─────────────────────────────────
  getScore(pubkey: string, issuerType: number): number {
    if (issuerType === 1) return TRUST_OFFICIAL  // 公的機関は固定
    return this.scores.get(pubkey) ?? TRUST_INITIAL
  }

  // ── スパム検出 ───────────────────────────────────
  // 1時間以内にSPAM_THRESHOLD件以上送信していたらtrue
  isSpam(pubkey: string, timestamp: number): boolean {
    const hist = this.history.get(pubkey) ?? []
    const recent = hist.filter(t => timestamp - t < SPAM_WINDOW_SEC)
    return recent.length >= SPAM_THRESHOLD
  }

  // ── パケット受信時の処理 ─────────────────────────
  recordPacket(packet: RawPacket): void {
    if (packet.issuerType === 1) return  // 公的機関は更新しない

    const { pubkey, timestamp } = packet

    // 送信履歴に追加
    const hist = this.history.get(pubkey) ?? []
    hist.push(timestamp)
    // 古い履歴を削除（1時間より古いもの）
    const cleaned = hist.filter(t => timestamp - t < SPAM_WINDOW_SEC)
    this.history.set(pubkey, cleaned)

    // スパム判定でDOWN
    if (this.isSpam(pubkey, timestamp)) {
      this._adjust(pubkey, -TRUST_DOWN_SPAM)
    }
  }

  // ── 裏付けが取れたときにUP ───────────────────────
  // 同じ場所・同じカテゴリを別のユーザーも報告した
  corroborate(pubkey: string, byOfficial: boolean): void {
    if (!pubkey) return
    const delta = byOfficial ? TRUST_UP_OFFICIAL : TRUST_UP_CORROBORATE
    this._adjust(pubkey, delta)
  }

  // ── 内部: スコアを調整 ───────────────────────────
  private _adjust(pubkey: string, delta: number): void {
    const current = this.scores.get(pubkey) ?? TRUST_INITIAL
    const next    = Math.min(TRUST_MAX, Math.max(TRUST_MIN, current + delta))
    this.scores.set(pubkey, next)
  }

  // ── デバッグ用: 全スコアを取得 ──────────────────
  getAllScores(): Map<string, number> {
    return new Map(this.scores)
  }
}
