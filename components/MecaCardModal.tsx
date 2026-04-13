import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Linking,
  Share,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const c = Colors.dark;
const { width: SW } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SW - 48, 340);

export type BadgeType = "black" | "gold" | "silver";

interface MecaCardProps {
  badge: {
    id: string;
    badgeType: BadgeType;
    note?: string | null;
    createdAt: string;
  };
  player: {
    id: string;
    name: string;
    position: string;
    number: number;
    elo: number;
    stats: { touchdowns: number; wins: number; mvpAwards: number };
  };
  teamName?: string;
  visible: boolean;
  onClose: () => void;
}

const BADGE_CONFIG: Record<BadgeType, {
  gradient: [string, string, string];
  accent: string;
  border: string;
  label: string;
  glow: string;
  symbol: string;
}> = {
  black: {
    gradient: ["#0D0D1A", "#111827", "#0D1B2A"],
    accent: "#A8B5CC",
    border: "#2A3A5C",
    label: "BLACK",
    glow: "#A8B5CC20",
    symbol: "◼",
  },
  gold: {
    gradient: ["#1A1000", "#2D1F00", "#1A1200"],
    accent: "#FFD93D",
    border: "#FFD93D40",
    label: "GOLD",
    glow: "#FFD93D25",
    symbol: "◆",
  },
  silver: {
    gradient: ["#141414", "#1E1E1E", "#0F0F0F"],
    accent: "#C8D0DC",
    border: "#C8D0DC40",
    label: "SILVER",
    glow: "#C8D0DC20",
    symbol: "◇",
  },
};

function BadgeIcon({ type, size = 20 }: { type: BadgeType; size?: number }) {
  const cfg = BADGE_CONFIG[type];
  return (
    <View style={[badgeIconStyles.wrap, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: cfg.glow, borderColor: cfg.border, borderWidth: 1 }]}>
      <Text style={[badgeIconStyles.symbol, { fontSize: size * 0.6, color: cfg.accent }]}>{cfg.symbol}</Text>
    </View>
  );
}

const badgeIconStyles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  symbol: { fontWeight: "900" },
});

export { BadgeIcon };

export default function MecaCardModal({ badge, player, teamName, visible, onClose }: MecaCardProps) {
  const insets = useSafeAreaInsets();
  const cfg = BADGE_CONFIG[badge.badgeType as BadgeType] || BADGE_CONFIG.silver;
  const initials = player.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const cardId = `MECA-${badge.id.slice(0, 8).toUpperCase()}`;

  const handleViewCard = async () => {
    const base = getApiUrl();
    const url = `${base}api/badges/${badge.id}/card`;
    try {
      await Linking.openURL(url);
    } catch {
      /* ignore */
    }
  };

  const handleShare = async () => {
    const base = getApiUrl();
    const url = `${base}api/badges/${badge.id}/card`;
    try {
      await Share.share({
        message: `Check out ${player.name}'s ${cfg.label} MECA Badge Card! ${url}`,
        url,
      });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          {/* ── CARD ── */}
          <LinearGradient
            colors={cfg.gradient as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { borderColor: cfg.border, width: CARD_WIDTH }]}
          >
            {/* glow */}
            <View style={[styles.cardGlow, { backgroundColor: cfg.glow }]} pointerEvents="none" />

            {/* header */}
            <View style={styles.cardHeader}>
              <Text style={[styles.mecaLabel, { color: cfg.accent }]}>⬡ MECA 7v7</Text>
              <View style={[styles.tierPill, { borderColor: cfg.accent + "60", backgroundColor: cfg.accent + "15" }]}>
                <Text style={[styles.tierPillText, { color: cfg.accent }]}>{cfg.symbol} {cfg.label}</Text>
              </View>
            </View>

            {/* avatar */}
            <View style={[styles.avatarRing, { borderColor: cfg.accent + "50" }]}>
              <LinearGradient
                colors={[cfg.accent + "30", cfg.accent + "10"]}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { color: cfg.accent }]}>{initials}</Text>
              </LinearGradient>
            </View>

            {/* name */}
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={[styles.playerSub, { color: cfg.accent + "AA" }]}>
              {teamName || "Free Agent"} · {player.position} · #{player.number}
            </Text>

            {/* divider */}
            <View style={[styles.divider, { backgroundColor: cfg.accent + "25" }]} />

            {/* stats */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{player.stats.touchdowns}</Text>
                <Text style={[styles.statLabel, { color: cfg.accent + "80" }]}>TDs</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{player.stats.wins}</Text>
                <Text style={[styles.statLabel, { color: cfg.accent + "80" }]}>WINS</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{player.stats.mvpAwards}</Text>
                <Text style={[styles.statLabel, { color: cfg.accent + "80" }]}>MVPs</Text>
              </View>
            </View>

            {/* divider */}
            <View style={[styles.divider, { backgroundColor: cfg.accent + "25" }]} />

            {/* ELO */}
            <View style={styles.eloRow}>
              <Text style={[styles.eloLabel, { color: cfg.accent + "80" }]}>ELO RATING</Text>
              <Text style={[styles.eloValue, { color: cfg.accent }]}>{player.elo}</Text>
            </View>

            {badge.note ? (
              <View style={[styles.noteBox, { borderColor: cfg.accent + "30", backgroundColor: cfg.accent + "08" }]}>
                <Text style={[styles.noteText, { color: cfg.accent + "CC" }]}>"{badge.note}"</Text>
              </View>
            ) : null}

            {/* card ID */}
            <Text style={[styles.cardId, { color: cfg.accent + "40" }]}>{cardId}</Text>
          </LinearGradient>

          {/* ── ACTIONS ── */}
          <View style={styles.actions}>
            <Pressable style={[styles.walletBtn]} onPress={handleViewCard}>
              <LinearGradient
                colors={["#1A1A1A", "#000"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.walletGrad}
              >
                <Ionicons name="wallet" size={18} color="#fff" />
                <Text style={styles.walletText}>Open Digital Card</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={c.accent} />
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end", alignItems: "center",
  },
  sheet: {
    width: "100%", backgroundColor: c.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    alignItems: "center", paddingTop: 12, paddingHorizontal: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.border, marginBottom: 24,
  },
  card: {
    borderRadius: 24, padding: 24, borderWidth: 1.5,
    alignItems: "center", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8, shadowRadius: 40, elevation: 20,
    marginBottom: 24,
  },
  cardGlow: {
    position: "absolute", top: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", width: "100%", marginBottom: 20,
  },
  mecaLabel: {
    fontSize: 11, fontFamily: "Outfit_700Bold",
    letterSpacing: 3, textTransform: "uppercase",
  },
  tierPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  tierPillText: {
    fontSize: 10, fontFamily: "Outfit_700Bold",
    letterSpacing: 2, textTransform: "uppercase",
  },
  avatarRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2, justifyContent: "center",
    alignItems: "center", marginBottom: 14,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 28, fontFamily: "Outfit_700Bold" },
  playerName: {
    fontSize: 20, fontFamily: "Outfit_700Bold",
    color: "#fff", textAlign: "center", marginBottom: 4,
  },
  playerSub: {
    fontSize: 11, fontFamily: "Outfit_500Medium",
    textAlign: "center", letterSpacing: 1,
    textTransform: "uppercase", marginBottom: 18,
  },
  divider: { height: 1, width: "100%", marginVertical: 14 },
  statsRow: { flexDirection: "row", gap: 0, width: "100%", justifyContent: "space-around", marginBottom: 4 },
  stat: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 20, fontFamily: "Outfit_700Bold", color: "#fff" },
  statLabel: { fontSize: 9, fontFamily: "Outfit_600SemiBold", letterSpacing: 1.5, marginTop: 2 },
  eloRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center" },
  eloLabel: { fontSize: 10, fontFamily: "Outfit_600SemiBold", letterSpacing: 2, textTransform: "uppercase" },
  eloValue: { fontSize: 22, fontFamily: "Outfit_700Bold" },
  noteBox: {
    marginTop: 14, width: "100%", borderRadius: 12,
    borderWidth: 1, padding: 10,
  },
  noteText: { fontSize: 12, fontFamily: "Outfit_400Regular", textAlign: "center", fontStyle: "italic" },
  cardId: {
    fontSize: 9, fontFamily: "Outfit_400Regular",
    letterSpacing: 2, marginTop: 16,
  },
  actions: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 12 },
  walletBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  walletGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  walletText: { fontSize: 14, fontFamily: "Outfit_700Bold", color: "#fff" },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 14, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surface,
  },
  shareBtnText: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.accent },
  closeBtn: { paddingVertical: 10 },
  closeBtnText: { fontSize: 14, fontFamily: "Outfit_500Medium", color: c.textTertiary },
});
