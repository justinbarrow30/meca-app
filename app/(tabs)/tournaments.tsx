import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useTournaments } from "@/lib/api-hooks";
import { Tournament } from "@/lib/types";

const c = Colors.dark;
type Filter = "all" | "live" | "upcoming" | "completed";

function getBaseName(name: string): string {
  return name.replace(/\s*-\s*(10U|12U|14U|15U|18U|Open)\s*$/i, "").trim();
}

interface EventGroup {
  baseName: string;
  tournaments: Tournament[];
  primary: Tournament;
  ageGroups: string[];
  hasLive: boolean;
  bestStatus: "live" | "upcoming" | "completed";
}

function EventCard({ group }: { group: EventGroup }) {
  const { primary, baseName, ageGroups, hasLive, bestStatus } = group;
  const isLive = hasLive;
  const isCompleted = bestStatus === "completed";
  const date = new Date(primary.date);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const statusConfig = {
    live: { label: "LIVE NOW", color: "#E8272C", bg: "#E8272C" + "14" },
    upcoming: { label: "UPCOMING", color: c.accent, bg: c.accent + "14" },
    completed: { label: "COMPLETED", color: c.textTertiary, bg: c.textTertiary + "14" },
  };
  const status = statusConfig[bestStatus];

  const onPress = () => {
    router.push({ pathname: "/tournament/[id]", params: { id: primary.id } });
  };

  const textColor = isLive ? "#fff" : c.text;
  const subColor = isLive ? "rgba(255,255,255,0.7)" : c.textTertiary;

  const totalTeams = group.tournaments.reduce((sum, t) => sum + t.registeredTeams.length, 0);
  const totalSlots = group.tournaments.reduce((sum, t) => sum + t.teamCount, 0);

  const content = (
    <>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <View style={[styles.statusBadge, { backgroundColor: isLive ? "rgba(255,217,61,0.25)" : status.bg }]}>
            {isLive && <View style={[styles.liveDot, { backgroundColor: "#FFD93D" }]} />}
            <Text style={[styles.statusText, { color: isLive ? "#FFD93D" : status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.tournamentName, { color: textColor }]}>{baseName}</Text>

      {ageGroups.length > 0 && (
        <View style={styles.ageRow}>
          {ageGroups.map((ag) => (
            <View key={ag} style={[styles.ageGroupBadge, isLive && { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Text style={[styles.ageGroupText, isLive && { color: "#fff" }]}>{ag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.tournamentMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={subColor} />
          <Text style={[styles.metaText, { color: subColor }]}>{dateStr}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color={subColor} />
          <Text style={[styles.metaText, { color: subColor }]} numberOfLines={1}>{primary.location}</Text>
        </View>
      </View>

      <View style={styles.tournamentFooter}>
        <View style={styles.teamsCount}>
          <Ionicons name="people" size={14} color={isLive ? "rgba(255,255,255,0.8)" : c.textSecondary} />
          <Text style={[styles.teamsText, isLive && { color: "rgba(255,255,255,0.8)" }]}>
            {totalTeams}/{totalSlots} Teams
          </Text>
        </View>
        {ageGroups.length > 1 && (
          <View style={[styles.divisionsBadge, isLive && { backgroundColor: "rgba(245,230,66,0.25)" }]}>
            <Ionicons name="layers-outline" size={13} color={isLive ? "#FFD93D" : c.accent} />
            <Text style={[styles.divisionsText, isLive && { color: "#FFD93D" }]}>
              {ageGroups.length} Divisions
            </Text>
          </View>
        )}
      </View>
    </>
  );

  return (
    <Pressable onPress={onPress}>
      {isLive ? (
        <LinearGradient
          colors={["#5B7AFF", "#4460E6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tournamentCard}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.tournamentCard, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, isCompleted && { opacity: 0.7 }]}>
          {content}
        </View>
      )}
    </Pressable>
  );
}

export default function TournamentsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: tournaments = [], isLoading } = useTournaments();

  const eventGroups = useMemo(() => {
    const grouped = new Map<string, Tournament[]>();
    for (const t of tournaments) {
      const base = getBaseName(t.name);
      if (!grouped.has(base)) grouped.set(base, []);
      grouped.get(base)!.push(t);
    }

    const statusPriority: Record<string, number> = { live: 0, upcoming: 1, completed: 2 };

    const groups: EventGroup[] = [];
    for (const [baseName, tourns] of grouped) {
      const hasLive = tourns.some(t => t.status === "live");
      const hasUpcoming = tourns.some(t => t.status === "upcoming");
      const bestStatus: "live" | "upcoming" | "completed" = hasLive ? "live" : hasUpcoming ? "upcoming" : "completed";

      const primary = tourns.find(t => t.status === bestStatus) || tourns[0];

      const ageGroups = [...new Set(
        tourns.map(t => t.ageGroup).filter((ag): ag is string => !!ag)
      )];
      const ageOrder = ["10U", "12U", "14U", "15U", "18U", "Open"];
      ageGroups.sort((a, b) => ageOrder.indexOf(a) - ageOrder.indexOf(b));

      groups.push({ baseName, tournaments: tourns, primary, ageGroups, hasLive, bestStatus });
    }

    groups.sort((a, b) => {
      const aPri = statusPriority[a.bestStatus] ?? 1;
      const bPri = statusPriority[b.bestStatus] ?? 1;
      if (aPri !== bPri) return aPri - bPri;
      return new Date(a.primary.date).getTime() - new Date(b.primary.date).getTime();
    });

    return groups;
  }, [tournaments]);

  const filtered = eventGroups.filter((g) => {
    if (filter === "all") return true;
    return g.tournaments.some(t => t.status === filter);
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Past" },
  ];

  if (isLoading) {
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
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.pageTitle}>Events</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={40} color={c.textTertiary} />
            <Text style={styles.emptyText}>No events found</Text>
          </View>
        ) : (
          filtered.map((g) => <EventCard key={g.baseName} group={g} />)
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingHorizontal: 16 },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: c.text,
    paddingTop: 12,
    marginBottom: 16,
  },
  filterRow: { gap: 8, marginBottom: 20, paddingRight: 16 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  filterChipActive: {
    backgroundColor: c.accent + "14",
    borderColor: c.accent,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: c.textSecondary,
  },
  filterTextActive: { color: c.accent },
  tournamentCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 1,
  },
  tournamentName: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: c.text,
    marginBottom: 8,
  },
  ageRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  ageGroupBadge: {
    backgroundColor: "#F59E0B" + "14",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ageGroupText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: "#F59E0B",
    letterSpacing: 0.5,
  },
  tournamentMeta: { gap: 4, marginBottom: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: c.textTertiary,
    flex: 1,
  },
  tournamentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamsCount: { flexDirection: "row", alignItems: "center", gap: 6 },
  teamsText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: c.textSecondary,
  },
  divisionsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: c.accent + "14",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  divisionsText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: c.accent,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
    color: c.textTertiary,
  },
});
