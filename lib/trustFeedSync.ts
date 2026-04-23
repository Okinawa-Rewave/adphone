/**
 * TrustMap（trustmap-scoring）のクラスタスコアと、通知フィードの trustLevel / trustScore を揃える。
 */
import type { TrustLevel } from "@/contexts/NotificationContext";
import { TYPE_TO_CATEGORY, levelToSeverity } from "@/contexts/DisasterReportContext";
import type { PostPayload } from "@/lib/postPayload";
import { postPayloadStableId } from "@/lib/postPayload";
import { trustMapEngine } from "@/lib/trustmap";
import type { ScoredEvent } from "@/trustmap-scoring/src/types/ScoredEvent";
import { haversineKm } from "@/trustmap-scoring/src/utils/haversine";

const MATCH_RADIUS_KM = 0.15;
const SEV_TOLERANCE = 1;

function findMatchingScoredEvent(
  p: PostPayload,
  events: ScoredEvent[]
): ScoredEvent | null {
  if (p.lat == null || p.lon == null) return null;
  const cat = TYPE_TO_CATEGORY[p.disasterType];
  const wantSev = levelToSeverity(p.damageLevel);
  let best: ScoredEvent | null = null;
  let bestDist = Infinity;
  for (const e of events) {
    if (e.category !== cat) continue;
    if (Math.abs(e.severity - wantSev) > SEV_TOLERANCE) continue;
    const distKm = haversineKm(p.lat, p.lon, e.lat, e.lng);
    if (distKm > MATCH_RADIUS_KM) continue;
    if (distKm < bestDist) {
      bestDist = distKm;
      best = e;
    }
  }
  return best;
}

/** ScoredEvent（マップのクラスタ）→ フィード用 0〜100 とラベル */
export function scoredEventToFeedTrust(ev: ScoredEvent): {
  trustLevel: TrustLevel;
  trustScore: number;
} {
  let trustScore = Math.min(100, Math.round(12 + ev.score * 1.15));
  if (ev.hasOfficial) trustScore = Math.min(100, trustScore + 12);
  trustScore = Math.min(100, trustScore + Math.min(8, Math.max(0, ev.witnessCount - 1) * 2));

  let trustLevel: TrustLevel;
  if (ev.stars >= 3 && ev.hasOfficial) trustLevel = "verified";
  else if (ev.hasOfficial) trustLevel = "partial";
  else if (ev.stars >= 3) trustLevel = "verified";
  else if (ev.stars === 2) trustLevel = "partial";
  else trustLevel = "unverified";

  return { trustLevel, trustScore };
}

/**
 * 現在の TrustMapEngine の状態から、投稿に対応するクラスタを探し信頼度を返す。
 * 先にエンジンへパケットが入っていること。
 */
export function computeFeedTrustForPostPayload(p: PostPayload): {
  trustLevel: TrustLevel;
  trustScore: number;
} {
  const myLat = p.lat ?? 0;
  const myLng = p.lon ?? 0;
  const events = trustMapEngine.computeScores(myLat, myLng);
  const ev = findMatchingScoredEvent(p, events);
  if (!ev) {
    const hasLoc = p.lat != null && p.lon != null;
    return { trustLevel: "unverified", trustScore: hasLoc ? 28 : 22 };
  }
  return scoredEventToFeedTrust(ev);
}

/** BLE 受信・ローカル投稿を TrustMap の LocalDB に載せる（フィードと同一 ID） */
export function ingestPostPayloadIntoTrustMap(
  p: PostPayload,
  opts?: { pubkey?: string }
): void {
  if (p.lat == null || p.lon == null) return;
  const id = postPayloadStableId(p);
  trustMapEngine.recordObservation(
    {
      category:   TYPE_TO_CATEGORY[p.disasterType],
      severity:   levelToSeverity(p.damageLevel),
      lat:        p.lat,
      lng:        p.lon,
      issuerType: 0,
      pubkey:     opts?.pubkey ?? "ble",
      signature:  "sig",
      note:       p.text.trim() || undefined,
    },
    "sig",
    { id, timestamp: p.timestamp }
  );
}
