/**
 * UIContext — サイドドロワー / 投稿モーダルのグローバル開閉状態を管理
 */
import React, { createContext, useContext, useState } from "react";

type UIContextValue = {
  isSideDrawerOpen: boolean;
  openSideDrawer: () => void;
  closeSideDrawer: () => void;
  isCreatePostOpen: boolean;
  openCreatePost: () => void;
  closeCreatePost: () => void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isSideDrawerOpen, setSideDrawer] = useState(false);
  const [isCreatePostOpen, setCreatePost] = useState(false);

  return (
    <UIContext.Provider
      value={{
        isSideDrawerOpen,
        openSideDrawer:  () => setSideDrawer(true),
        closeSideDrawer: () => setSideDrawer(false),
        isCreatePostOpen,
        openCreatePost:  () => setCreatePost(true),
        closeCreatePost: () => setCreatePost(false),
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
