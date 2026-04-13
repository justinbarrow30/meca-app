import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useTournaments, useTeams, useTeamRankings, useUnreadNotificationCount } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import { Team, Tournament } from "@/lib/types";
import AuthGateModal from "@/components/AuthGateModal";

const c = Colors.dark;

function useCountdown(targetDate: string) {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const target = new Date(targetDate).getTime();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return { days, hours, minutes, seconds, expired: diff <= 0 };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.countdownUnit}>
      <Text style={styles.countdownValue}>{String(value).padStart(2, "0")}</Text>
      <Text style={styles.countdownLabel}>{label}</Text>
    </View>
  );
}

function getBaseName(name: string): string {
  return name.replace(/\s*-\s*(10U|12U|14U|15U|18U|Open)\s*$/i, "").trim();
}

function LiveBlock({ tournaments }: { tournaments: Tournament[] }) {
  const primary = tournaments[0];
  const baseName = getBaseName(primary.name);
  const ageGroups = [...new Set(tournaments.map(t => t.ageGroup).filter((ag): ag is string => !!ag))];
  const ageOrder = ["10U", "12U", "14U", "15U", "18U", "Open"];
  ageGroups.sort((a, b) => ageOrder.indexOf(a) - ageOrder.indexOf(b));
  const divisionCount = tournaments.length;

  return (
    <LinearGradient
      colors={["#5B7AFF", "#4460E6"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.primaryBlock}
    >
      <View style={styles.liveBadgeRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE NOW</Text>
        </View>
      </View>

      <Text style={styles.tournamentName}>{baseName}</Text>

      {ageGroups.length > 0 && (
        <View style={styles.ageRow}>
          {ageGroups.map((ag) => (
            <View key={ag} style={styles.agePill}>
              <Text style={styles.agePillText}>{ag}</Text>
            </View>
          ))}
        </View>
      )}

      {primary.location ? (
        <View style={styles.metaRow}>
          <Ionicons name="location" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.metaText}>{primary.location}</Text>
        </View>
      ) : null}

      {divisionCount > 1 && (
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Ionicons name="layers-outline" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statText}>{divisionCount} Divisions</Text>
          </View>
        </View>
      )}

      <Pressable
        style={styles.openTournamentBtn}
        onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: primary.id } })}
      >
        <Text style={styles.openTournamentText}>Open Tournament</Text>
        <Ionicons name="arrow-forward" size={16} color="#5B7AFF" />
      </Pressable>
    </LinearGradient>
  );
}

function UpcomingBlock({ tournaments }: { tournaments: Tournament[] }) {
  const primary = tournaments[0];
  const baseName = getBaseName(primary.name);
  const ageGroups = [...new Set(tournaments.map(t => t.ageGroup).filter((ag): ag is string => !!ag))];
  const ageOrder = ["10U", "12U", "14U", "15U", "18U", "Open"];
  ageGroups.sort((a, b) => ageOrder.indexOf(a) - ageOrder.indexOf(b));
  const countdown = useCountdown(primary.date);

  return (
    <LinearGradient
      colors={["#5B7AFF", "#4460E6"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.primaryBlock}
    >
      <Text style={styles.upcomingLabel}>NEXT EVENT</Text>
      <Text style={styles.tournamentName}>{baseName}</Text>

      {ageGroups.length > 0 && (
        <View style={styles.ageRow}>
          {ageGroups.map((ag) => (
            <View key={ag} style={styles.agePill}>
              <Text style={styles.agePillText}>{ag}</Text>
            </View>
          ))}
        </View>
      )}

      {primary.location ? (
        <View style={styles.metaRow}>
          <Ionicons name="location" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.metaText}>{primary.location}</Text>
        </View>
      ) : null}

      <View style={styles.countdownRow}>
        <CountdownUnit value={countdown.days} label="DAYS" />
        <Text style={styles.countdownSep}>:</Text>
        <CountdownUnit value={countdown.hours} label="HRS" />
        <Text style={styles.countdownSep}>:</Text>
        <CountdownUnit value={countdown.minutes} label="MIN" />
        <Text style={styles.countdownSep}>:</Text>
        <CountdownUnit value={countdown.seconds} label="SEC" />
      </View>

      <Pressable
        style={styles.openTournamentBtn}
        onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: primary.id } })}
      >
        <Text style={styles.openTournamentText}>View Event</Text>
        <Ionicons name="arrow-forward" size={16} color="#5B7AFF" />
      </Pressable>
    </LinearGradient>
  );
}

function IdleBlock({ nextTournaments }: { nextTournaments: Tournament[] | null }) {
  if (nextTournaments && nextTournaments.length > 0) {
    return <UpcomingBlock tournaments={nextTournaments} />;
  }

  return (
    <LinearGradient
      colors={["#5B7AFF", "#4460E6"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.primaryBlock}
    >
      <MaterialCommunityIcons name="football" size={36} color="#FFD93D" style={{ alignSelf: "center", marginBottom: 8 }} />
      <Text style={styles.idleTitle}>MECA 7v7</Text>
      <Text style={styles.idleSub}>No upcoming events</Text>

      <Pressable
        style={styles.viewEventBtn}
        onPress={() => router.push("/(tabs)/tournaments")}
      >
        <Text style={styles.viewEventBtnText}>Browse Tournaments</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </LinearGradient>
  );
}

function RankingRow({ rank, name, elo, teamColor, id }: {
  rank: number; name: string; elo: number; teamColor?: string; id: string;
}) {
  const badgeColors: Record<number, string> = { 1: "#D4A84B", 2: "#9CA3AF", 3: "#CD7F32" };

  return (
    <Pressable
      style={styles.rankRow}
      onPress={() => router.push({ pathname: "/team/[id]", params: { id } })}
    >
      <View style={[styles.rankBadge, badgeColors[rank] ? { backgroundColor: badgeColors[rank] } : {}]}>
        <Text style={styles.rankNumber}>{rank}</Text>
      </View>
      <View style={[styles.rankDot, { backgroundColor: teamColor || c.accent }]} />
      <Text style={styles.rankName} numberOfLines={1}>{name}</Text>
      <Text style={styles.rankElo}>{elo}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { user } = useAuth();
  const { data: tournaments = [], isLoading: tournamentsLoading } = useTournaments();
  const { data: teams = [] } = useTeams();
  const { data: teamRankings = [] } = useTeamRankings();
  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = user ? (unreadData?.count || 0) : 0;

  const [showAuthGate, setShowAuthGate] = useState(false);

  const teamsMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const liveEventGroups = useMemo(() => {
    const live = tournaments.filter((t) => t.status === "live");
    const groups = new Map<string, Tournament[]>();
    for (const t of live) {
      const base = getBaseName(t.name);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(t);
    }
    return Array.from(groups.values());
  }, [tournaments]);

  const upcomingEventGroup = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const upcoming = tournaments
      .filter((t) => t.status === "upcoming" && new Date(t.date).getTime() - now <= sevenDays && new Date(t.date).getTime() > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (upcoming.length === 0) return null;
    const base = getBaseName(upcoming[0].name);
    return upcoming.filter((t) => getBaseName(t.name) === base);
  }, [tournaments]);

  const nextEventGroup = useMemo(() => {
    const upcoming = tournaments
      .filter((t) => t.status === "upcoming")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (upcoming.length === 0) return null;
    const base = getBaseName(upcoming[0].name);
    return upcoming.filter((t) => getBaseName(t.name) === base);
  }, [tournaments]);

  const top5Teams = useMemo(() => teamRankings.slice(0, 5), [teamRankings]);

  if (tournamentsLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#5B7AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/splash-logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Pressable testID="notification-bell" style={styles.notifBtn} onPress={() => {
            if (user) router.push("/notifications");
            else setShowAuthGate(true);
          }}>
            <Ionicons name="notifications-outline" size={22} color={c.text} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {liveEventGroups.length > 0 ? (
          liveEventGroups.map((group) => (
            <LiveBlock key={getBaseName(group[0].name)} tournaments={group} />
          ))
        ) : upcomingEventGroup ? (
          <UpcomingBlock tournaments={upcomingEventGroup} />
        ) : (
          <IdleBlock nextTournaments={nextEventGroup} />
        )}

        <Pressable
          style={styles.allTournamentsBtn}
          onPress={() => router.push("/(tabs)/tournaments")}
        >
          <LinearGradient
            colors={["rgba(79,106,246,0.15)", "rgba(79,106,246,0.08)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.allTournamentsBtnInner}
          >
            <Ionicons name="calendar" size={20} color={c.accent} />
            <Text style={styles.allTournamentsBtnText}>View All Tournaments</Text>
            <Ionicons name="arrow-forward" size={18} color={c.accent} />
          </LinearGradient>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Ionicons name="trophy" size={16} color="#D4A84B" />
          <Text style={styles.sectionTitle}>Top Teams</Text>
        </View>

        <View style={styles.rankingsCard}>
          {top5Teams.length > 0 ? (
            top5Teams.map((entry) => {
              const team = teamsMap.get(entry.teamId || "");
              return (
                <RankingRow
                  key={entry.teamId || entry.name}
                  rank={entry.rank}
                  name={entry.name}
                  elo={entry.elo}
                  teamColor={team?.primaryColor}
                  id={entry.teamId || ""}
                />
              );
            })
          ) : (
            <Text style={styles.emptyText}>No rankings available yet</Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <AuthGateModal visible={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  logoImage: { width: 168, height: 80 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface,
    justifyContent: "center", alignItems: "center",
  },
  notifBadge: {
    position: "absolute", top: 2, right: 2, backgroundColor: "#EF4444",
    borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center",
    alignItems: "center", paddingHorizontal: 3,
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Outfit_700Bold", lineHeight: 14 },

  primaryBlock: {
    borderRadius: 20, padding: 24, marginBottom: 24,
  },
  liveBadgeRow: {
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: "rgba(232,39,44,0.2)",
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, gap: 8,
    alignSelf: "flex-start",
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E8272C" },
  liveText: { fontSize: 12, fontFamily: "Outfit_700Bold", color: "#FF6B6B", letterSpacing: 1.5 },

  tournamentName: {
    fontSize: 24, fontFamily: "Outfit_700Bold", color: "#fff", marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20,
  },
  metaText: { fontSize: 13, fontFamily: "Outfit_400Regular", color: "rgba(255,255,255,0.6)" },

  statsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20,
  },
  statPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10,
  },
  statDotLive: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#E8272C" },
  statText: { fontSize: 12, fontFamily: "Outfit_500Medium", color: "rgba(255,255,255,0.85)" },
  ageRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12,
  },
  agePill: {
    backgroundColor: "rgba(245,230,66,0.2)", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  agePillText: { fontSize: 11, fontFamily: "Outfit_700Bold", color: "#FFD93D", letterSpacing: 0.5 },

  openTournamentBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14,
  },
  openTournamentText: { fontSize: 15, fontFamily: "Outfit_700Bold", color: "#5B7AFF" },

  upcomingLabel: {
    fontSize: 11, fontFamily: "Outfit_700Bold", color: "rgba(255,255,255,0.5)",
    letterSpacing: 2, marginBottom: 8,
  },
  countdownRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 24,
  },
  countdownUnit: { alignItems: "center", minWidth: 52 },
  countdownValue: {
    fontSize: 32, fontFamily: "Outfit_700Bold", color: "#FFD93D",
  },
  countdownLabel: {
    fontSize: 9, fontFamily: "Outfit_600SemiBold", color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginTop: 2,
  },
  countdownSep: { fontSize: 24, fontFamily: "Outfit_700Bold", color: "rgba(255,255,255,0.3)", marginTop: -8 },

  idleTitle: {
    fontSize: 22, fontFamily: "Outfit_700Bold", color: "#fff",
    textAlign: "center", marginBottom: 4,
  },
  idleSub: {
    fontSize: 13, fontFamily: "Outfit_400Regular", color: "rgba(255,255,255,0.6)",
    textAlign: "center", marginBottom: 24,
  },
  viewEventBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 14,
  },
  viewEventBtnText: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: "#fff" },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 4,
  },
  sectionTitle: { fontSize: 18, fontFamily: "Outfit_700Bold", color: c.text },

  rankingsCard: {
    backgroundColor: c.surface, borderRadius: 16, overflow: "hidden",
  },
  rankRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: c.borderLight,
    gap: 12,
  },
  rankBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: c.border,
    justifyContent: "center", alignItems: "center",
  },
  rankNumber: { fontSize: 12, fontFamily: "Outfit_700Bold", color: "#fff" },
  rankDot: { width: 10, height: 10, borderRadius: 5 },
  rankName: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text, flex: 1 },
  rankElo: { fontSize: 15, fontFamily: "Outfit_700Bold", color: "#D4A84B" },
  emptyText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: c.textTertiary, padding: 20, textAlign: "center" },

  allTournamentsBtn: {
    marginBottom: 24, borderRadius: 16, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(79,106,246,0.3)",
  },
  allTournamentsBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 16,
  },
  allTournamentsBtnText: { fontSize: 16, fontFamily: "Outfit_700Bold", color: c.accent },
});
