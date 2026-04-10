import { Design } from "@/constants/Design";

export const LEVEL_CONFIG = {
  Lv1: { label: "軽微な損傷",       color: Design.colors.success, bg: Design.colors.successMuted },
  Lv2: { label: "中程度の損傷",     color: Design.colors.warning, bg: Design.colors.warningMuted },
  Lv3: { label: "重大な損傷・倒壊", color: Design.colors.danger,  bg: Design.colors.dangerMuted  },
} as const;

/** null=未撮影, "manual"=手動選択待ち, "Lv1"|"Lv2"|"Lv3"=確定値 */
export type DamageLevel = keyof typeof LEVEL_CONFIG | "manual" | null;
