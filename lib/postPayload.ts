import type { DisasterType, NotificationItem, TrustLevel } from "@/contexts/NotificationContext";
import type { DamageLevel } from "@/constants/BuildingDamage";
import { LEVEL_CONFIG } from "@/constants/BuildingDamage";

export type PostPayload = {
  disasterType: DisasterType;
  damageLevel: DamageLevel;
  lat: number | null;
  lon: number | null;
  text: string;
  timestamp: number; // Unix秒
};

const TYPE_CODE: Record<DisasterType, string> = {
  earthquake: "E",
  flood: "F",
  fire: "I",
  collapse: "C",
  landslide: "L",
  other: "O",
};

const CODE_TYPE: Record<string, DisasterType> = Object.fromEntries(
  Object.entries(TYPE_CODE).map(([k, v]) => [v, k as DisasterType])
);

const DMG_CODE: Partial<Record<NonNullable<DamageLevel>, string>> = {
  Lv1: "L1",
  Lv2: "L2",
  Lv3: "L3",
  // "manual" はワイヤーフォーマットに含めない（"--" 扱い）
};

const CODE_DMG: Record<string, NonNullable<DamageLevel>> = {
  L1: "Lv1",
  L2: "Lv2",
  L3: "Lv3",
};

const MAX_BYTES = 500;

export function encodePayload(p: PostPayload): string {
  const encoder = new TextEncoder();
  const type = TYPE_CODE[p.disasterType] ?? "O";
  const dmg = p.damageLevel ? DMG_CODE[p.damageLevel] : "--";
  const loc =
    p.lat != null && p.lon != null
      ? `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`
      : "--,--";
  const ts = String(p.timestamp);
  const prefix = `ADPH|v1|${type}|${dmg}|${loc}|${ts}|`;
  const prefixBytes = encoder.encode(prefix).length;
  const budget = MAX_BYTES - prefixBytes;

  let txt = p.text.replace(/\|/g, "｜");
  while (encoder.encode(txt).length > budget) {
    txt = txt.slice(0, -1);
  }

  return prefix + txt;
}

export function decodePayload(s: string): PostPayload | null {
  try {
    const parts = s.split("|");
    if (parts.length < 7 || parts[0] !== "ADPH" || parts[1] !== "v1") return null;

    const disasterType = CODE_TYPE[parts[2]];
    if (!disasterType) return null;

    const damageLevel = parts[3] === "--" ? null : (CODE_DMG[parts[3]] ?? null);

    const locStr = parts[4];
    let lat: number | null = null;
    let lon: number | null = null;
    if (locStr !== "--,--") {
      const [latStr, lonStr] = locStr.split(",");
      lat = parseFloat(latStr);
      lon = parseFloat(lonStr);
      if (isNaN(lat) || isNaN(lon)) { lat = null; lon = null; }
    }

    const timestamp = parseInt(parts[5], 10);
    if (isNaN(timestamp)) return null;

    // テキストはインデックス6以降をすべて結合（本来は1フィールドだが念のため）
    const text = parts.slice(6).join("|");

    return { disasterType, damageLevel, lat, lon, text, timestamp };
  } catch {
    return null;
  }
}

/** 投稿・BLE・TrustMap のパケットで共有する決定論的 ID */
export function postPayloadStableId(
  p: Pick<PostPayload, "timestamp" | "disasterType" | "text">
): string {
  return `adph-${p.timestamp}-${p.disasterType}-${p.text.slice(0, 8).replace(/\s/g, "")}`;
}

/** PostPayload を NotificationItem に変換（フィード表示用） */
export function payloadToNotificationItem(
  p: PostPayload,
  opts?: { author?: string; trustLevel?: TrustLevel; trustScore?: number }
): NotificationItem {
  const tsMs = p.timestamp * 1000;
  const date = new Date(tsMs);
  const time = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const dmgLabel = p.damageLevel ? LEVEL_CONFIG[p.damageLevel].label : null;
  const text = dmgLabel ? `[${dmgLabel}] ${p.text}` : p.text;

  const location =
    p.lat != null && p.lon != null
      ? `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`
      : undefined;

  return {
    // タイムスタンプ+種別+テキスト先頭8字から決定論的IDを生成。
    // 送信側の即時追加とBLE受信側の追加で同一IDになるため、addItem()の重複チェックで片方が弾かれる。
    id: postPayloadStableId(p),
    text,
    time,
    unread: true,
    disasterType: p.disasterType,
    trustLevel: opts?.trustLevel ?? "unverified",
    trustScore: opts?.trustScore ?? 30,
    timestamp: tsMs,
    author: opts?.author ?? "市民レポート",
    location,
    helpfulCount: 0,
    nearbyConfirmations: 0,
  };
}
