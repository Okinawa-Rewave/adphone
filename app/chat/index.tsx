// app/chat/index.tsx — チャットハブ（地域チャット / 個人タブ）
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { MobileFrame } from "@/components/MobileFrame";
import { AppBar } from "@/components/AppBar";
import { BottomTab, BOTTOM_TAB_HEIGHT } from "@/components/BottomTab";
import { ChatTabSwitch, type ChatTab } from "@/components/ChatTabSwitch";
import { RegionalChatView } from "@/components/RegionalChatView";
import { ContactListView } from "@/components/ContactListView";

export default function ChatScreen() {
  const [activeTab, setActiveTab] = useState<ChatTab>("regional");

  return (
    <MobileFrame>
      <AppBar title="チャット" showBack={false} />

      {/* タブスイッチャー */}
      <ChatTabSwitch
        activeTab={activeTab}
        onChange={setActiveTab}
        onlineCount={activeTab === "regional" ? 12 : undefined}
      />

      {/* タブコンテンツ */}
      <View style={[styles.content, { paddingBottom: BOTTOM_TAB_HEIGHT }]}>
        {activeTab === "regional" ? (
          <RegionalChatView onlineCount={12} />
        ) : (
          <ContactListView />
        )}
      </View>

      <BottomTab />
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
