import { Design } from "@/constants/Design";

/** タイムスタンプを「たった今」「X分前」「X時間前」形式に変換 */
export function formatTimeAgo(ts: Date | string | number): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 60000;
  if (diff < 1) return "たった今";
  if (diff < 60) return `${Math.floor(diff)}分前`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

/** 経過時間ごとの鮮度カラーを返す */
export function getFreshnessColor(ts: Date | string | number): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 60000;
  if (diff < 10) return Design.colors.freshnessHot;
  if (diff < 30) return Design.colors.freshnessWarm;
  if (diff < 60) return Design.colors.freshnessCool;
  return Design.colors.freshnessOld;
}

/** タイムスタンプを「HH:MM」形式に変換 */
export function formatHHMM(ts: Date | string | number): string {
  return new Date(ts).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
