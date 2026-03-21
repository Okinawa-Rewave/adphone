// app/index.tsx
import { AppHeader } from "@/components/AppHeader";
import { BrowserHeader } from "@/components/BrowserHeader";
import { Design } from "@/constants/Design";
import { MobileFrame } from '@/components/MobileFrame';
import { NavButton } from '@/components/NavButton';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Bell,
  Bot,
  Camera,
  Map as MapIcon,
  MessageSquare,
  Settings,
  Phone,
  Package,
  BookOpen,
} from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { Link, useRouter } from 'expo-router';



const MIN_SPIN_MS = 500;
const SUCCESS_PULSE_MS = 600;
const HOME_NOTIFICATION_LIMIT = 5;

export default function HomeScreen() {
  const router = useRouter();
  const { items, unreadCount, markRead, refresh } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccessPulse, setRefreshSuccessPulse] = useState(false);
  const refreshStartedAtRef = useRef<number | null>(null);

  const stopRefreshingSuccess = () => {
    const startedAt = refreshStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, MIN_SPIN_MS - elapsed);
    setTimeout(() => {
      setRefreshing(false);
      refreshStartedAtRef.current = null;
      setRefreshSuccessPulse(true);
      setTimeout(() => setRefreshSuccessPulse(false), SUCCESS_PULSE_MS);
    }, remaining);
  };

  const handleRefresh = async () => {
    refreshStartedAtRef.current = Date.now();
    setRefreshSuccessPulse(false);
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      stopRefreshingSuccess();
    }
  };

  const handleNotificationPress = (id: string, href?: string) => {
    markRead(id);
    if (href) router.push(href as any);
  };

  const displayItems = items.slice(0, HOME_NOTIFICATION_LIMIT);


  return (
    <MobileFrame isOnline={true}>
      <BrowserHeader
        showBack={false}
        refreshing={refreshing}
        refreshSuccessPulse={refreshSuccessPulse}
        onRefresh={handleRefresh}
      />
      <AppHeader title="ホーム" showBack={false} />

      {/* 通知エリア（上部30%） */}
      <View style={styles.notificationArea}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>通知</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <ScrollView style={styles.notificationList} showsVerticalScrollIndicator={false}>
          {displayItems.length === 0 ? (
            <Text style={styles.emptyText}>通知はありません</Text>
          ) : (
            displayItems.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.notificationRow, n.unread && styles.notificationRowUnread]}
                onPress={() => handleNotificationPress(n.id, n.href)}
              >
                <Text style={styles.notificationText} numberOfLines={2}>
                  • {n.text}
                </Text>
                <View style={styles.notificationRight}>
                  <Text style={styles.notificationTime}>{n.time}</Text>
                  {n.unread && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            ))
          )}

          {items.length > HOME_NOTIFICATION_LIMIT && (
            <Link href="/notifications" asChild>
              <TouchableOpacity style={styles.moreLink}>
                <Text style={styles.moreLinkText}>もっと見る</Text>
              </TouchableOpacity>
            </Link>
          )}

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => Linking.openURL('tel:110')}
            >
              <Phone size={18} color={Design.colors.danger} />
              <Text style={styles.quickActionText}>110</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => Linking.openURL('tel:119')}
            >
              <Phone size={18} color={Design.colors.danger} />
              <Text style={styles.quickActionText}>119</Text>
            </TouchableOpacity>
            <Link href="/disaster/emergency-contacts" asChild>
              <TouchableOpacity style={styles.quickActionButton}>
                <Phone size={18} color={Design.colors.primary} />
                <Text style={styles.quickActionText}>連絡先</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </View>

      {/* ★ 下部だけスクロール可能に */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          <NavButton
            href="/chat"
            icon={<MessageSquare size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="チャット"
            badge={1}
          />

          <NavButton
            href="/map"
            icon={<MapIcon size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="マップ"
          />

          <NavButton
            href="/camera"
            icon={<Camera size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="カメラ"
          />

          <NavButton
            href="/settings"
            icon={<Settings size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="かんたん設定"
          />
        </View>

        <View style={[styles.grid, styles.gridBottom]}>
          <NavButton
            href="/disaster/checklist"
            icon={<Package size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="防災グッズ"
          />

          <NavButton
            href="/disaster/manual"
            icon={<BookOpen size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="行動マニュアル"
          />
        </View>

        <View style={[styles.grid, styles.gridBottom]}>
          <NavButton
            href="/ai"
            icon={<Bot size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="AI"
          />

          <NavButton
            href="/notifications"
            icon={<Bell size={128} strokeWidth={1.0} color={Design.colors.text} />}
            label="通知"
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
        </View>
      </ScrollView>
    </MobileFrame>
  );
}


const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  notificationArea: {
    backgroundColor: Design.colors.surface,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    height: Dimensions.get("window").height * 0.30,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Design.spacing.sm,
    marginBottom: Design.spacing.md,
  },
  notificationTitle: {
    fontSize: Design.fontSize.title,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  unreadBadge: {
    backgroundColor: Design.colors.danger,
    borderRadius: Design.radius.sm,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Design.spacing.sm,
  },
  unreadBadgeText: {
    color: Design.colors.white,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
  },
  notificationList: {
    flex: 1,
  },
  emptyText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    paddingVertical: Design.spacing.md,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Design.colors.background,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.md,
    marginBottom: Design.spacing.sm,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  notificationRowUnread: {
    backgroundColor: Design.colors.primaryMuted,
    borderColor: Design.colors.border,
  },
  notificationText: {
    flex: 1,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    marginRight: Design.spacing.sm,
  },
  notificationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Design.spacing.sm,
  },
  notificationTime: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Design.colors.danger,
  },
  moreLink: {
    alignSelf: 'flex-start',
    paddingVertical: Design.spacing.sm,
    paddingRight: Design.spacing.xs,
    marginBottom: Design.spacing.sm,
  },
  moreLinkText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.primary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Design.spacing.sm,
    marginTop: Design.spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Design.spacing.sm,
    backgroundColor: Design.colors.background,
    paddingVertical: Design.spacing.md,
    paddingHorizontal: Design.spacing.md,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  quickActionText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
  },
  grid: {
    paddingHorizontal: Design.spacing.lg,
    paddingTop: Design.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Design.spacing.md,
  },
  gridBottom: {
    paddingBottom: Design.spacing.lg,
  },
});
