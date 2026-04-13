import React from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useGame } from "@/lib/api-hooks";

const c = Colors.dark;

function PlayerRow({ player, teamColor }: { player: any; teamColor: string }) {
  return (
    <Pressable
      style={s.playerRow}
      onPress={() => router.push({ pathname: "/player/[id]", params: { id: player.id } })}
    >
      <View style={[s.playerNumber, { backgroundColor: teamColor + "20" }]}>
        <Text style={[s.playerNumberText, { color: teamColor }]}>#{player.number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.playerName}>{player.name}</Text>
        <Text style={s.playerPos}>{player.position}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={c.textTertiary} />
    </Pressable>
  );
}

function TeamSide({ team, score, isWinner, isLive, align }: {
  team: any;
  score: number;
  isWinner: boolean;
  isLive: boolean;
  align: "left" | "right";
}) {
  if (!team) {
    return (
      <View style={[s.teamSide, align === "right" && { alignItems: "flex-end" }]}>
        <Text style={s.tbdText}>TBD</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={[s.teamSide, align === "right" && { alignItems: "flex-end" }]}
      onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
    >
      <View style={[s.teamLogo, { backgroundColor: team.color }]}>
        <Text style={s.teamLogoText}>{team.logoInitials || team.abbreviation?.slice(0, 3)}</Text>
      </View>
      <Text style={[s.teamNameScore, isWinner && s.winnerName]} numberOfLines={1}>{team.name}</Text>
      <Text style={s.teamRegion}>{team.region || "East Coast"}</Text>
      <Text style={s.teamRecord}>
        {team.wins}W - {team.losses}L{team.ties > 0 ? ` - ${team.ties}T` : ""}
      </Text>
      <Text style={[
        s.scoreNumber,
        isLive && s.scoreLive,
        isWinner && s.scoreWinner,
      ]}>
        {score}
      </Text>
    </Pressable>
  );
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const { data: game, isLoading } = useGame(id || "");
  const g = game as any;

  if (isLoading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!g) {
    return (
      <View style={[s.container, { paddingTop: topInset + 12 }]}>
        <View style={{ paddingHorizontal: 16 }}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
        </View>
        <View style={s.empty}>
          <Ionicons name="football-outline" size={40} color={c.textTertiary} />
          <Text style={s.emptyText}>Game not found</Text>
        </View>
      </View>
    );
  }

  const isLive = g.status === "live";
  const isCompleted = g.status === "final" || g.status === "completed" || g.status === "locked";
  const isScheduled = !isLive && !isCompleted;
  const winnerId = g.winnerId;
  const teamA = g.teamA;
  const teamB = g.teamB;
  const rosterA = teamA?.roster || [];
  const rosterB = teamB?.roster || [];

  const statusLabel = isLive ? "LIVE" : isCompleted ? "FINAL" : "UPCOMING";
  const statusColor = isLive ? "#E8272C" : isCompleted ? c.green : c.accent;

  const scheduledStr = g.scheduledTime
    ? new Date(g.scheduledTime).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : null;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>

        <LinearGradient
          colors={isLive ? ["#E8272C", "#B91C1C"] : isCompleted ? ["#1E293B", "#0F172A"] : [c.accent, "#4460E6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.scoreboard, { backgroundColor: isLive ? "#E8272C" : isCompleted ? "#1E293B" : c.accent }]}
        >
          <View style={s.topBar}>
            <View style={[s.statusPill, { backgroundColor: isLive ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)" }]}>
              {isLive && <View style={s.liveDot} />}
              <Text style={[s.statusText, { color: "#fff" }]}>{statusLabel}</Text>
            </View>
            {g.roundName && (
              <Text style={[s.roundLabel, { color: "rgba(255,255,255,0.8)" }]}>
                {g.roundName}
              </Text>
            )}
          </View>

          {g.tournament && (
            <Text style={[s.tournamentName, { color: "rgba(255,255,255,0.7)" }]}>
              {g.tournament.name}
            </Text>
          )}

          <View style={s.matchupRow}>
            <TeamSide team={teamA} score={g.scoreA ?? 0} isWinner={winnerId === teamA?.id} isLive={isLive} align="left" />
            <View style={s.vsBox}>
              {(isLive || isCompleted) ? (
                <Text style={[s.vsText, { color: "rgba(255,255,255,0.4)" }]}>vs</Text>
              ) : (
                <Text style={[s.vsText, { color: "rgba(255,255,255,0.4)" }]}>VS</Text>
              )}
            </View>
            <TeamSide team={teamB} score={g.scoreB ?? 0} isWinner={winnerId === teamB?.id} isLive={isLive} align="right" />
          </View>

          {scheduledStr && (
            <View style={s.infoRow}>
              <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.6)" />
              <Text style={[s.infoText, { color: "rgba(255,255,255,0.7)" }]}>{scheduledStr}</Text>
            </View>
          )}
          {g.field && (
            <View style={s.infoRow}>
              <Ionicons name="football-outline" size={13} color="rgba(255,255,255,0.6)" />
              <Text style={[s.infoText, { color: "rgba(255,255,255,0.7)" }]}>{g.field.name}</Text>
            </View>
          )}
        </LinearGradient>

        {isCompleted && winnerId && (
          <View style={s.winnerBanner}>
            <Ionicons name="trophy" size={18} color="#D4A84B" />
            <Text style={s.winnerBannerText}>
              {winnerId === teamA?.id ? teamA?.name : teamB?.name} wins
            </Text>
          </View>
        )}

        {teamA && rosterA.length > 0 && (
          <View style={s.rosterSection}>
            <View style={s.rosterHeader}>
              <View style={[s.rosterDot, { backgroundColor: teamA.color }]} />
              <Text style={s.rosterTitle}>{teamA.name} Roster</Text>
              <Text style={s.rosterCount}>{rosterA.length} players</Text>
            </View>
            {rosterA
              .sort((a: any, b: any) => a.number - b.number)
              .map((p: any) => (
                <PlayerRow key={p.id} player={p} teamColor={teamA.color} />
              ))}
          </View>
        )}

        {teamB && rosterB.length > 0 && (
          <View style={s.rosterSection}>
            <View style={s.rosterHeader}>
              <View style={[s.rosterDot, { backgroundColor: teamB.color }]} />
              <Text style={s.rosterTitle}>{teamB.name} Roster</Text>
              <Text style={s.rosterCount}>{rosterB.length} players</Text>
            </View>
            {rosterB
              .sort((a: any, b: any) => a.number - b.number)
              .map((p: any) => (
                <PlayerRow key={p.id} player={p} teamColor={teamB.color} />
              ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: c.surface,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
    borderWidth: 1, borderColor: c.border,
  },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontFamily: "Outfit_500Medium", fontSize: 15, color: c.textSecondary },

  scoreboard: {
    borderRadius: 20, padding: 20, marginBottom: 16,
  },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4,
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  statusText: { fontFamily: "Outfit_700Bold", fontSize: 11, letterSpacing: 1 },
  roundLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 12 },
  tournamentName: { fontFamily: "Outfit_500Medium", fontSize: 12, marginBottom: 16, marginTop: 2 },

  matchupRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  teamSide: { flex: 1, alignItems: "center", gap: 6 },
  teamLogo: {
    width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },
  teamLogoText: { fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" },
  teamNameScore: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: "#fff", textAlign: "center" },
  winnerName: { color: "#FFD93D" },
  teamRegion: { fontFamily: "Outfit_400Regular", fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center" },
  teamRecord: { fontFamily: "Outfit_500Medium", fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  scoreNumber: { fontFamily: "Outfit_700Bold", fontSize: 36, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  scoreLive: { color: "#fff" },
  scoreWinner: { color: "#FFD93D" },
  tbdText: { fontFamily: "Outfit_500Medium", fontSize: 16, color: "rgba(255,255,255,0.4)", marginTop: 20 },

  vsBox: { width: 40, alignItems: "center", justifyContent: "center", paddingTop: 70 },
  vsText: { fontFamily: "Outfit_700Bold", fontSize: 14 },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, justifyContent: "center" },
  infoText: { fontFamily: "Outfit_400Regular", fontSize: 12 },

  winnerBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    backgroundColor: "rgba(212,168,75,0.12)", borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(212,168,75,0.25)",
  },
  winnerBannerText: { fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#D4A84B" },

  rosterSection: {
    backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: c.border,
  },
  rosterHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  rosterDot: { width: 10, height: 10, borderRadius: 5 },
  rosterTitle: { fontFamily: "Outfit_600SemiBold", fontSize: 15, color: c.text, flex: 1 },
  rosterCount: { fontFamily: "Outfit_400Regular", fontSize: 12, color: c.textTertiary },

  playerRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: c.border + "40",
  },
  playerNumber: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  playerNumberText: { fontFamily: "Outfit_700Bold", fontSize: 12 },
  playerName: { fontFamily: "Outfit_500Medium", fontSize: 14, color: c.text },
  playerPos: { fontFamily: "Outfit_400Regular", fontSize: 11, color: c.textTertiary },
});
