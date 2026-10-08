/**
 * スマホ ↔ Pi の BLE プロトコル v2
 *
 * Pi 側の実装: Raspberry/lpwa/mesh/bleproto.py（形式を変えるときは両方そろえること）
 *
 * BLE の 1 パケット（チャンク）: 0xAD | stream(1) | ctl(1) | data
 *   ctl: bit7 = 続きがある, bit0-6 = 何番目か
 *   stream: スマホは接続ごとに 1〜255 の乱数、Pi は 0
 *
 * チャンクを組み立てたもの（フレーム）: ver(1) | kind(1) | msg_id(4) | from(2) | to(2) | payload
 *   MSG       スマホ→Pi: 送信（msg_id = アプリが付けた番号, to = 宛先）
 *             Pi→スマホ: 受信（msg_id = Pi の受信箱の連番, from = 送信元ノード）
 *   STATUS    Pi→スマホ: 配送状態（msg_id = アプリが付けた番号, payload = 状態 [+ ホップ数]）
 *   HELLO     スマホ→Pi: 接続直後（payload = client_id 8B + 最後に受け取った連番 4B）
 *   INFO      Pi→スマホ: HELLO への返事（payload = JSON）
 *   NODES_REQ スマホ→Pi / NODES Pi→スマホ（payload = JSON の配列）
 *
 * React Native に依存しない純粋な関数だけを置く（UTF-8 と base64 も自前で持つ）。
 */

export const MAGIC = 0xad;
export const VERSION = 2;
export const CHUNK_MAX = 180;
export const CHUNK_HEADER = 3;
export const CHUNK_DATA = CHUNK_MAX - CHUNK_HEADER;
export const MAX_CHUNKS = 64;
export const FRAME_HEADER = 10;
export const BROADCAST = 0xffff;

export const Kind = {
  MSG: 0x01,
  STATUS: 0x02,
  HELLO: 0x03,
  INFO: 0x04,
  NODES_REQ: 0x05,
  NODES: 0x06,
} as const;
export type KindValue = (typeof Kind)[keyof typeof Kind];

/** Pi が返す配送状態（bleproto.py の ST_*） */
export const Status = {
  QUEUED: 1,
  SENT: 2,
  RELAYED: 3,
  DELIVERED: 4,
  WAITING: 5,
  FAILED: 6,
} as const;

/** アプリで扱う配送状態。sending は「スマホから Pi へ書き込み中」 */
export type DeliveryState =
  | "sending"
  | "queued"
  | "sent"
  | "relayed"
  | "delivered"
  | "waiting"
  | "failed";

export function statusToState(code: number): DeliveryState | null {
  switch (code) {
    case Status.QUEUED:
      return "queued";
    case Status.SENT:
      return "sent";
    case Status.RELAYED:
      return "relayed";
    case Status.DELIVERED:
      return "delivered";
    case Status.WAITING:
      return "waiting";
    case Status.FAILED:
      return "failed";
    default:
      return null;
  }
}

export type Frame = {
  kind: number;
  msgId: number;
  src: number;
  dest: number;
  payload: Uint8Array;
};

export function encodeFrame(f: Frame): Uint8Array {
  const out = new Uint8Array(FRAME_HEADER + f.payload.length);
  const view = new DataView(out.buffer);
  view.setUint8(0, VERSION);
  view.setUint8(1, f.kind);
  view.setUint32(2, f.msgId >>> 0);
  view.setUint16(6, f.src & 0xffff);
  view.setUint16(8, f.dest & 0xffff);
  out.set(f.payload, FRAME_HEADER);
  return out;
}

export function decodeFrame(raw: Uint8Array): Frame | null {
  if (raw.length < FRAME_HEADER) return null;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (view.getUint8(0) !== VERSION) return null;
  return {
    kind: view.getUint8(1),
    msgId: view.getUint32(2),
    src: view.getUint16(6),
    dest: view.getUint16(8),
    payload: raw.slice(FRAME_HEADER),
  };
}

export function isChunk(data: Uint8Array): boolean {
  return data.length >= CHUNK_HEADER && data[0] === MAGIC;
}

/** フレームを BLE のパケットに分ける */
export function chunk(frame: Uint8Array, stream: number): Uint8Array[] {
  const n = Math.max(1, Math.ceil(frame.length / CHUNK_DATA));
  if (n > MAX_CHUNKS) throw new Error(`frame too long: ${frame.length} bytes`);
  const out: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const part = frame.slice(i * CHUNK_DATA, (i + 1) * CHUNK_DATA);
    const c = new Uint8Array(CHUNK_HEADER + part.length);
    c[0] = MAGIC;
    c[1] = stream & 0xff;
    c[2] = (i < n - 1 ? 0x80 : 0) | i;
    c.set(part, CHUNK_HEADER);
    out.push(c);
  }
  return out;
}

/** チャンクを stream ごとに組み立てる。順番が飛んだら、その stream の途中のものは捨てる */
export class Reassembler {
  private buf = new Map<number, { started: number; next: number; parts: Uint8Array[] }>();

  constructor(private timeoutMs = 10_000) {}

  add(data: Uint8Array, now = Date.now()): { stream: number; frame: Uint8Array } | null {
    if (!isChunk(data)) return null;
    const stream = data[1];
    const more = (data[2] & 0x80) !== 0;
    const index = data[2] & 0x7f;
    let cur = this.buf.get(stream);
    if (cur && now - cur.started > this.timeoutMs) cur = undefined;
    if (index === 0) cur = { started: now, next: 0, parts: [] };
    if (!cur || cur.next !== index) {
      this.buf.delete(stream);
      return null;
    }
    cur.parts.push(data.slice(CHUNK_HEADER));
    if (more) {
      cur.next = index + 1;
      this.buf.set(stream, cur);
      return null;
    }
    this.buf.delete(stream);
    return { stream, frame: concat(cur.parts) };
  }
}

export function helloPayload(clientId: Uint8Array, since: number): Uint8Array {
  const out = new Uint8Array(12);
  out.set(clientId.slice(0, 8));
  new DataView(out.buffer).setUint32(8, since >>> 0);
  return out;
}

// ─── バイト列のユーティリティ ──────────────────────────────────────────────

export function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f)
      );
  }
  return Uint8Array.from(out);
}

export function utf8Decode(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c >= 0xc0 && c < 0xe0 && i < b.length) cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
    else if (c >= 0xe0 && c < 0xf0 && i + 1 < b.length) {
      cp = ((c & 0x0f) << 12) | ((b[i] & 0x3f) << 6) | (b[i + 1] & 0x3f);
      i += 2;
    } else if (c >= 0xf0 && i + 2 < b.length) {
      cp = ((c & 0x07) << 18) | ((b[i] & 0x3f) << 12) | ((b[i + 1] & 0x3f) << 6) | (b[i + 2] & 0x3f);
      i += 3;
    } else cp = 0xfffd;
    if (cp >= 0x10000) {
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else s += String.fromCharCode(cp);
  }
  return s;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** react-native-ble-plx は値を base64 でやり取りする */
export function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += i + 1 < b.length ? B64[(n >> 6) & 63] : "=";
    s += i + 2 < b.length ? B64[n & 63] : "=";
  }
  return s;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((clean[i + 2] ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (clean[i + 3] ? B64.indexOf(clean[i + 3]) : 0);
    out.push((n >> 16) & 0xff);
    if (clean[i + 2]) out.push((n >> 8) & 0xff);
    if (clean[i + 3]) out.push(n & 0xff);
  }
  return Uint8Array.from(out);
}
