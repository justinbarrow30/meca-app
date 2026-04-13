import React, { useMemo, useState } from "react";
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useTeamRankings, useTeams } from "@/lib/api-hooks";
import { LeaderboardEntry, Team } from "@/lib/types";

const c = Colors.dark;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <View style={[styles.rankBadge, { backgroundColor: "#FFD93D" + "30" }]}>
        <MaterialCommunityIcons name="crown" size={14} color="#D4A84B" />
      </View>
    );
  if (rank === 2)
    return (
      <View style={[styles.rankBadge, { backgroundColor: "#9CA3AF" + "20" }]}>
        <Text style={[styles.rankNum, { color: "#9CA3AF" }]}>{rank}</Text>
      </View>
    );
  if (rank === 3)
    return (
      <View style={[styles.rankBadge, { backgroundColor: "#CD7F32" + "20" }]}>
        <Text style={[styles.rankNum, { color: "#CD7F32" }]}>{rank}</Text>
      </View>
    );
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankNum}>{rank}</Text>
    </View>
  );
}

function TeamRankRow({ entry, teamsMap }: { entry: LeaderboardEntry; teamsMap: Map<string, Team> }) {
  const team = teamsMap.get(entry.teamId || "");
  if (!team) return null;

  return (
    <Pressable
      style={styles.rankRow}
      onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
    >
      <RankBadge rank={entry.rank} />
      <View style={[styles.teamAvatar, { backgroundColor: team.color }]}>
        <Text style={styles.teamAvatarText}>{team.logoInitials}</Text>
      </View>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName}>{team.name}</Text>
        <Text style={styles.rankMeta}>{team.region || team.ageGroup}</Text>
      </View>
      <View style={styles.recordBlock}>
        <Text style={styles.recordValue}>{team.record.wins}W - {team.record.losses}L</Text>
      </View>
    </Pressable>
  );
}

const AGE_GROUPS = ["10U", "12U", "14U", "15U", "18U"] as const;

export default function RankingsScreen() {
  const insets = useSafeAreaInsets();
  const [ageGroup, setAgeGroup] = useState<string>("14U");
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: teamRankings = [], isLoading: teamRankingsLoading } = useTeamRankings(undefined, ageGroup);
  const { data: teams = [], isLoading: teamsLoading } = useTeams();

  const isLoading = teamRankingsLoading || teamsLoading;

  const teamsMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

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
        <Text style={styles.pageTitle}>Team Rankings</Text>

        <View style={styles.ageGroupRow}>
          {AGE_GROUPS.map((ag) => (
            <Pressable
              key={ag}
              style={[styles.ageGroupPill, ageGroup === ag && styles.ageGroupPillActive]}
              onPress={() => setAgeGroup(ag)}
            >
              <Text style={[styles.ageGroupText, ageGroup === ag && styles.ageGroupTextActive]}>
                {ag}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>RANK</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, marginLeft: 48 }]}>TEAM</Text>
          <Text style={styles.tableHeaderText}>RECORD</Text>
        </View>

        {teamRankings.map((entry) => <TeamRankRow key={entry.teamId} entry={entry} teamsMap={teamsMap} />)}

        {teamRankings.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Ionicons name="trophy-outline" size={40} color={c.textTertiary} />
            <Text style={{ fontSize: 14, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 12 }}>
              No teams ranked yet for this age group
            </Text>
          </View>
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
    marginBottom: 12,
  },
  ageGroupRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  ageGroupPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  ageGroupPillActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  ageGroupText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: c.textSecondary,
  },
  ageGroupTextActive: {
    color: "#fff",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: c.textTertiary,
    letterSpacing: 1,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    gap: 10,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.surface,
  },
  rankNum: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: c.textSecondary,
  },
  teamAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  teamAvatarText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  rankInfo: { flex: 1 },
  rankName: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: c.text,
  },
  rankMeta: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: c.textTertiary,
    marginTop: 1,
  },
  recordBlock: { alignItems: "flex-end" },
  recordValue: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: c.text,
  },
});
