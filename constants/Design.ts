/**
 * デザイントークン
 * 子ども〜高齢者まで直感的に使える、視認性重視・落ち着いた災害時アプリ用
 */
export const Design = {
  /** 角丸（やわらかく安心感） */
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 9999,
  },

  /** 余白（広め） */
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 28,
  },

  /** フォントサイズ（やや大きめ） */
  fontSize: {
    caption: 13,
    body: 16,
    bodyLarge: 18,
    subtitle: 18,
    title: 20,
    titleLarge: 22,
  },

  /** フォントウェイト */
  fontWeight: {
    normal: "500" as const,
    semi: "600" as const,
    bold: "700" as const,
  },

  /** 配色：視認性優先・コントラストはっきり・過度に派手でない */
  colors: {
    text: "#1f2937",
    textSecondary: "#4b5563",
    textMuted: "#6b7280",
    background: "#ffffff",
    surface: "#f8fafc",
    surfaceElevated: "#f1f5f9",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    primary: "#2563eb",
    primaryMuted: "#eff6ff",
    success: "#16a34a",
    successMuted: "#dcfce7",
    danger: "#dc2626",
    dangerMuted: "#fef2f2",
    warning: "#ca8a04",
    warningMuted: "#fef9c3",
    white: "#ffffff",

    // 信頼度カラー（rewave準拠）
    trustOfficial: "#0f74c5",
    trustOfficialMuted: "#dbeafe",
    trustVerified: "#189a30",
    trustVerifiedMuted: "#dcfce7",
    trustPartial: "#dba400",
    trustPartialMuted: "#fef9c3",
    trustUnverified: "#d41101",
    trustUnverifiedMuted: "#fff1f0",

    // 災害タイプカラー
    disasterEarthquake: "#f97316",
    disasterFlood: "#3b82f6",
    disasterFire: "#ef4444",
    disasterCollapse: "#78716c",
    disasterLandslide: "#d97706",
    disasterOther: "#6b7280",

    // 鮮度カラー（0-10分=緑, 10-30分=黄, 30-60分=青, 60分+=グレー）
    freshnessHot: "#16a34a",
    freshnessWarm: "#ca8a04",
    freshnessCool: "#2563eb",
    freshnessOld: "#9ca3af",
  },
};
