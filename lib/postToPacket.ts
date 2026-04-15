/**
 * PostPayload → RawPacket 変換ユーティリティ
 *
 * ローカル投稿（CreatePostModal → DisasterReportContext）と
 * BLE受信（BleToFeedBridge）の両経路で同一の変換ロジック・ID生成規則を使い、
 * TrustMapEngine の重複排除でエコーバックや再送を自動で弾く。
 */
import type { PostPayload } from './postPayload';
import type { RawPacket, Category } from '../trustmap-scoring/src/index';
import type { DisasterType } from '../contexts/NotificationContext';
import type { DamageLevel } from '../constants/BuildingDamage';

// ── DisasterType → TrustMap Category ──────────────────────
const TYPE_TO_CATEGORY: Record<DisasterType, Category> = {
  earthquake: 'danger',
  flood:      'flood',
  fire:       'fire',
  collapse:   'building_collapse',
  landslide:  'landslide',
  other:      'danger',
};

// ── DamageLevel → severity ────────────────────────────────
function levelToSeverity(level: DamageLevel): 1 | 2 | 3 | 4 | 5 {
  if (level === 'Lv1') return 2;
  if (level === 'Lv2') return 3;
  if (level === 'Lv3') return 5;
  return 3; // manual / null → 中程度
}

/**
 * ペイロード内容から決定論的 RawPacket.id を生成。
 * encode → BLE → decode しても同じ id が得られるため、
 * ローカル投稿と受信パケットで TrustMapEngine の重複排除が効く。
 */
export function deterministicPacketId(p: PostPayload): string {
  const lat = p.lat != null ? p.lat.toFixed(4) : 'x';
  const lon = p.lon != null ? p.lon.toFixed(4) : 'x';
  return `adph-${p.timestamp}-${p.disasterType}-${lat}-${lon}`;
}

/**
 * PostPayload を TrustMap の RawPacket に変換する。
 * 座標が無い場合はマップに載せられないため null を返す。
 */
export function payloadToRawPacket(p: PostPayload): RawPacket | null {
  if (p.lat == null || p.lon == null) return null;

  return {
    id:         deterministicPacketId(p),
    category:   TYPE_TO_CATEGORY[p.disasterType],
    severity:   levelToSeverity(p.damageLevel),
    lat:        p.lat,
    lng:        p.lon,
    timestamp:  p.timestamp,
    issuerType: 0,
    pubkey:     'local',
    signature:  'sig',
    note:       p.text.trim() || undefined,
  };
}
