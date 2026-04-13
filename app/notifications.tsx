import React, { useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useNotifications, useMarkNotificationsRead } from "@/lib/api-hooks";
import { Notification } from "@/lib/types";

const c = Colors.dark;

function getIcon(type: string): { name: string; color: string; bg: string } {
  switch (type) {
    case "player_approved":
      return { name: "checkmark-circle", color: "#2DD4A8", bg: "#2DD4A818" };
    case "announcement":
      return { name: "megaphone", color: "#5B7AFF", bg: "#5B7AFF18" };
    case "badge_awarded":
      return { name: "shield-checkmark", color: "#FFD93D", bg: "#FFD93D18" };
    case "game_result":
      return { name: "football", color: "#F59E0B", bg: "#F59E0B18" };
    default:
      return { name: "notifications", color: c.accent, bg: c.accent + "18" };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotificationItem({ item, onPress }: { item: Notification; onPress: () => void }) {
  const icon = getIcon(item.type);
  return (
    <Pressable
      style={[styles.notifItem, !item.read && styles.notifUnread]}
      onPress={onPress}
    >
      <View style={[styles.notifIcon, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name as any} size={20} color={icon.color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifTitleRow}>
          <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const unreadIds = useMemo(
    () => notifications.filter(n => !n.read).map(n => n.id),
    [notifications]
  );

  useEffect(() => {
    if (unreadIds.length > 0) {
      const timer = setTimeout(() => {
        markRead.mutate(unreadIds);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [unreadIds.length]);

  const renderItem = ({ item }: { item: Notification }) => (
    <NotificationItem
      item={item}
      onPress={() => {
        if (!item.read) {
          markRead.mutate([item.id]);
        }
        if (item.relatedType === "player" && item.relatedId) {
          router.push({ pathname: "/player/[id]", params: { id: item.relatedId } });
        }
      }}
    />
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadIds.length > 0 ? (
          <Pressable style={styles.markAllBtn} onPress={() => markRead.mutate(undefined)}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={48} color={c.textTertiary} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>You'll see updates here when something happens</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!notifications.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: c.background,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
    color: c.text,
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: c.accent,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Outfit_600SemiBold",
    color: c.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: c.textTertiary,
    textAlign: "center",
    marginTop: 6,
  },
  notifItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  notifUnread: {
    backgroundColor: c.surfaceElevated,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notifTitle: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: c.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.accent,
    marginLeft: 8,
  },
  notifMessage: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: c.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: c.textTertiary,
    marginTop: 4,
  },
});
