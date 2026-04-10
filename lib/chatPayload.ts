/**
 * ADCH ワイヤーフォーマット — LPWA ブロードキャストチャット用
 *
 * フォーマット（パイプ区切り、512バイト以内）:
 *   ADCH|v1|{senderIdShort}|{senderName}|{senderIcon}|{timestamp}|{text}
 *
 * ADPH（災害投稿）と区別するため先頭識別子を "ADCH" とする。
 */

const MAX_BYTES = 500;

export type LpwaChatMessage = {
  /** 決定論的ID: adch-{timestamp}-{senderIdShort}-{text先頭6字} */
  id: string;
  text: string;
  senderName: string;
  senderIcon: string;
  /** Firebase UID の先頭 8 文字。自分バブル判定に使う */
  senderIdShort: string;
  /** Unix 秒 */
  timestamp: number;
};

/** LpwaChatMessage から決定論的 ID を生成 */
export function makeChatId(m: Pick<LpwaChatMessage, "timestamp" | "senderIdShort" | "text">): string {
  const slug = m.text.slice(0, 6).replace(/\s/g, "");
  return `adch-${m.timestamp}-${m.senderIdShort}-${slug}`;
}

export function encodeChatMessage(m: LpwaChatMessage): string {
  const encoder = new TextEncoder();

  const escape = (s: string) => s.replace(/\|/g, "｜");
  const name = escape(m.senderName);
  const icon = escape(m.senderIcon);
  const prefix = `ADCH|v1|${m.senderIdShort}|${name}|${icon}|${m.timestamp}|`;
  const prefixBytes = encoder.encode(prefix).length;
  const budget = MAX_BYTES - prefixBytes;

  let txt = escape(m.text);
  while (encoder.encode(txt).length > budget) {
    txt = txt.slice(0, -1);
  }

  return prefix + txt;
}

export function decodeChatMessage(s: string): LpwaChatMessage | null {
  try {
    if (!s.startsWith("ADCH|")) return null;
    const parts = s.split("|");
    if (parts.length < 7 || parts[1] !== "v1") return null;

    const senderIdShort = parts[2];
    const senderName = parts[3].replace(/｜/g, "|");
    const senderIcon = parts[4].replace(/｜/g, "|");
    const timestamp = parseInt(parts[5], 10);
    if (isNaN(timestamp)) return null;

    // テキストはインデックス6以降を結合（｜を戻す）
    const text = parts.slice(6).join("|").replace(/｜/g, "|");

    const msg: LpwaChatMessage = { id: "", text, senderName, senderIcon, senderIdShort, timestamp };
    msg.id = makeChatId(msg);
    return msg;
  } catch {
    return null;
  }
}
