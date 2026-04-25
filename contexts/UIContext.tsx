/**
 * UIContext — サイドドロワー / 投稿モーダルのグローバル開閉状態を管理
 */
import React, { createContext, useContext, useState } from "react";
import type { DamageLevel } from "@/constants/BuildingDamage";

export type GemmaResultValue = { damageLevel: DamageLevel; content: string };

type UIContextValue = {
  isSideDrawerOpen: boolean;
  openSideDrawer: () => void;
  closeSideDrawer: () => void;
  isCreatePostOpen: boolean;
  openCreatePost: () => void;
  closeCreatePost: () => void;
  gemmaResult: GemmaResultValue | null;
  showGemmaResult: (r: GemmaResultValue) => void;
  dismissGemmaResult: () => void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isSideDrawerOpen, setSideDrawer] = useState(false);
  const [isCreatePostOpen, setCreatePost] = useState(false);
  const [gemmaResult, setGemmaResult] = useState<GemmaResultValue | null>(null);

  return (
    <UIContext.Provider
      value={{
        isSideDrawerOpen,
        openSideDrawer:  () => setSideDrawer(true),
        closeSideDrawer: () => setSideDrawer(false),
        isCreatePostOpen,
        openCreatePost:  () => setCreatePost(true),
        closeCreatePost: () => setCreatePost(false),
        gemmaResult,
        showGemmaResult:    (r) => setGemmaResult(r),
        dismissGemmaResult: () => setGemmaResult(null),
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
