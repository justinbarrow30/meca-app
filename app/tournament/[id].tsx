import React, { useMemo, useState, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useTournament, useTeams, useTournamentStandings, useTournamentSiblings, TournamentStanding, TournamentSibling } from "@/lib/api-hooks";
import FollowButton from "@/components/FollowButton";
import { Team, Match } from "@/lib/types";

const c = Colors.dark;

function GameCard({ match, teamsMap }: { match: Match; teamsMap: Map<string, Team> }) {
  const team1 = match.team1Id ? teamsMap.get(match.team1Id) : null;
  const team2 = match.team2Id ? teamsMap.get(match.team2Id) : null;
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";

  return (
    <Pressable
      style={[gameStyles.card, isLive && gameStyles.cardLive]}
      onPress={() => router.push({ pathname: "/game/[id]", params: { id: match.id } })}
    >
      <View style={gameStyles.cardHeader}>
        <View style={gameStyles.headerLeft}>
          <View style={[
            gameStyles.statusDot,
            { backgroundColor: isLive ? "#E8272C" : isCompleted ? c.green : c.textTertiary }
          ]} />
          <Text style={gameStyles.statusLabel}>
            {isLive ? "LIVE" : isCompleted ? "FINAL" : "UPCOMING"}
          </Text>
          {match.roundName && (
            <Text style={gameStyles.roundLabel}>{match.roundName}</Text>
          )}
        </View>
        <View style={gameStyles.headerRight}>
          {match.fieldName && (
            <View style={gameStyles.fieldBadge}>
              <Ionicons name="football-outline" size={10} color={c.accent} />
              <Text style={gameStyles.fieldText}>{match.fieldName}</Text>
            </View>
          )}
          {match.scheduledTime && (
            <Text style={gameStyles.timeText}>{match.scheduledTime}</Text>
          )}
        </View>
      </View>

      <View style={gameStyles.matchup}>
        <View style={gameStyles.teamSide}>
          {team1 ? (
            <>
              <View style={[gameStyles.teamDot, { backgroundColor: team1.color }]}>
                <Text style={gameStyles.teamDotText}>{team1.logoInitials}</Text>
              </View>
              <Text style={[gameStyles.teamName, match.winnerId === team1.id && gameStyles.winner]} numberOfLines={1}>
                {team1.name}
              </Text>
            </>
          ) : (
            <Text style={gameStyles.tbd}>TBD</Text>
          )}
        </View>

        <View style={gameStyles.scoreBox}>
          {(isLive || isCompleted) ? (
            <Text style={[gameStyles.score, isLive && { color: "#E8272C" }]}>
              {match.team1Score ?? 0} - {match.team2Score ?? 0}
            </Text>
          ) : (
            <Text style={gameStyles.vs}>VS</Text>
          )}
        </View>

        <View style={[gameStyles.teamSide, { alignItems: "flex-end" }]}>
          {team2 ? (
            <>
              <Text style={[gameStyles.teamName, match.winnerId === team2.id && gameStyles.winner, { textAlign: "right" as const }]} numberOfLines={1}>
                {team2.name}
              </Text>
              <View style={[gameStyles.teamDot, { backgroundColor: team2.color }]}>
                <Text style={gameStyles.teamDotText}>{team2.logoInitials}</Text>
              </View>
            </>
          ) : (
            <Text style={gameStyles.tbd}>TBD</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function AgeGroupPills({ siblings, currentId, onSelect }: { siblings: TournamentSibling[]; currentId: string; onSelect: (id: string) => void }) {
  return (
    <View style={ageStyles.row}>
      {siblings.map((sib) => {
        const isActive = sib.id === currentId;
        return (
          <Pressable
            key={sib.id}
            style={[ageStyles.pill, isActive && ageStyles.pillActive]}
            onPress={() => {
              if (!isActive) {
                onSelect(sib.id);
              }
            }}
          >
            <Text style={[ageStyles.pillText, isActive && ageStyles.pillTextActive]}>
              {sib.ageGroup}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeId, setActiveId] = useState(id || "");
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (id) setActiveId(id);
  }, [id]);

  const { data: tournament, isLoading: tournamentLoading } = useTournament(activeId);
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: standings = [] } = useTournamentStandings(activeId);
  const { data: siblings = [] } = useTournamentSiblings(activeId);

  const isLoading = tournamentLoading || teamsLoading;

  const teamsMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const allGames = useMemo(() => {
    if (!tournament?.bracket) return [];
    const matches = tournament.bracket.rounds.flatMap((r) => r.matches);
    return matches.sort((a, b) => {
      const statusOrder: Record<string, number> = { live: 0, scheduled: 1, completed: 2 };
      const aOrder = statusOrder[a.status] ?? 1;
      const bOrder = statusOrder[b.status] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if (a.scheduledTime && b.scheduledTime) {
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
      }
      return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
    });
  }, [tournament]);

  const previewGames = useMemo(() => {
    const withTeams = allGames.filter((m) => m.team1Id && m.team2Id);
    const live = withTeams.filter((m) => m.status === "live");
    const scheduled = withTeams.filter((m) => m.status === "pending");
    const completed = withTeams.filter((m) => m.status === "completed");
    return [...live, ...scheduled, ...completed].slice(0, 3);
  }, [allGames]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#5B7AFF" />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={[styles.container, { paddingTop: topInset + 12 }]}>
        <View style={{ paddingHorizontal: 16 }}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={40} color={c.textTertiary} />
          <Text style={styles.emptyText}>Tournament not found</Text>
        </View>
      </View>
    );
  }

  const isLive = tournament.status === "live";
  const date = new Date(tournament.date);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const statusColors: Record<string, string> = { live: "#E8272C", upcoming: c.accent, completed: c.textTertiary };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
          <FollowButton targetType="tournament" targetId={activeId} />
        </View>

        {siblings.length > 0 && (
          <AgeGroupPills siblings={siblings} currentId={activeId} onSelect={setActiveId} />
        )}

        <LinearGradient
          colors={isLive ? ["#5B7AFF", "#4460E6"] : [c.surface, c.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, !isLive && { borderWidth: 1, borderColor: c.border }]}
        >
          <View style={[styles.statusBadge, { backgroundColor: isLive ? "rgba(255,217,61,0.25)" : (statusColors[tournament.status] || c.textTertiary) + "14" }]}>
            {isLive && <View style={[styles.dot, { backgroundColor: "#FFD93D" }]} />}
            <Text style={[styles.statusText, { color: isLive ? "#FFD93D" : statusColors[tournament.status] || c.textTertiary }]}>
              {tournament.status.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.heroTitle, isLive && { color: "#fff" }]}>
            {tournament.name.replace(/\s*-\s*(10U|12U|14U|15U|18U|Open)\s*$/i, "").trim()}
          </Text>
          <View style={styles.heroMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar" size={14} color={isLive ? "rgba(255,255,255,0.7)" : c.textSecondary} />
              <Text style={[styles.metaValue, isLive && { color: "rgba(255,255,255,0.8)" }]}>{dateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location" size={14} color={isLive ? "rgba(255,255,255,0.7)" : c.textSecondary} />
              <Text style={[styles.metaValue, isLive && { color: "rgba(255,255,255,0.8)" }]}>{tournament.location}</Text>
            </View>
          </View>
          {allGames.length > 0 && (
            <Pressable
              style={[styles.viewBracketHeroBtn, isLive && styles.viewBracketHeroBtnLive]}
              onPress={() => router.push({ pathname: "/bracket/[id]", params: { id: tournament.id, tab: "bracket" } })}
            >
              <Ionicons name="git-network-outline" size={16} color={isLive ? "#5B7AFF" : "#fff"} />
              <Text style={[styles.viewBracketHeroText, isLive && styles.viewBracketHeroTextLive]}>View Bracket</Text>
              <Ionicons name="arrow-forward" size={14} color={isLive ? "#5B7AFF" : "#fff"} />
            </Pressable>
          )}
        </LinearGradient>

        {tournament.status === "completed" && tournament.bracket?.champion && (() => {
          const champTeam = teamsMap.get(tournament.bracket.champion!);
          if (!champTeam) return null;
          return (
            <Pressable
              style={styles.championCard}
              onPress={() => router.push({ pathname: "/team/[id]", params: { id: champTeam.id } })}
            >
              <LinearGradient
                colors={[champTeam.color + "30", champTeam.color + "08"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.championGradient}
              >
                <View style={styles.championTrophyRow}>
                  <Ionicons name="trophy" size={28} color="#FFD700" />
                </View>
                <Text style={styles.championLabel}>CHAMPION</Text>
                <View style={styles.championTeamRow}>
                  <View style={[styles.championTeamDot, { backgroundColor: champTeam.color }]}>
                    <Text style={styles.championTeamDotText}>{champTeam.logoInitials}</Text>
                  </View>
                  <Text style={styles.championTeamName}>{champTeam.name}</Text>
                </View>
              </LinearGradient>
            </Pressable>
          );
        })()}

        {tournament.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.descText}>{tournament.description}</Text>
          </View>
        )}

        {allGames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Games</Text>
            {previewGames.map((match) => (
              <GameCard key={match.id} match={match} teamsMap={teamsMap} />
            ))}
            {allGames.length > 2 && (
              <Pressable
                style={styles.viewAllBtn}
                onPress={() => router.push({ pathname: "/bracket/[id]", params: { id: tournament.id, tab: "games" } })}
              >
                <Text style={styles.viewAllText}>View All Games ({allGames.length})</Text>
                <Ionicons name="arrow-forward" size={16} color={c.accent} />
              </Pressable>
            )}
            {allGames.length <= 2 && (
              <Pressable
                style={styles.viewAllBtn}
                onPress={() => router.push({ pathname: "/bracket/[id]", params: { id: tournament.id, tab: "bracket" } })}
              >
                <Text style={styles.viewAllText}>View Bracket</Text>
                <Ionicons name="arrow-forward" size={16} color={c.accent} />
              </Pressable>
            )}
          </View>
        )}

        {standings.length > 0 && standings.some(s => s.gamesPlayed > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Standings</Text>
            <View style={standingStyles.table}>
              <View style={standingStyles.headerRow}>
                <Text style={[standingStyles.headerCell, { width: 28 }]}>#</Text>
                <Text style={[standingStyles.headerCell, { flex: 1 }]}>Team</Text>
                <Text style={[standingStyles.headerCell, standingStyles.statCell]}>W</Text>
                <Text style={[standingStyles.headerCell, standingStyles.statCell]}>L</Text>
                <Text style={[standingStyles.headerCell, standingStyles.statCell]}>T</Text>
                <Text style={[standingStyles.headerCell, standingStyles.statCell]}>PF</Text>
                <Text style={[standingStyles.headerCell, standingStyles.statCell]}>PA</Text>
                <Text style={[standingStyles.headerCell, { width: 38, textAlign: "center" as const }]}>+/-</Text>
              </View>
              {standings.map((s) => (
                <Pressable
                  key={s.teamId}
                  style={standingStyles.row}
                  onPress={() => router.push({ pathname: "/team/[id]", params: { id: s.teamId } })}
                >
                  <Text style={[standingStyles.rankCell, { width: 28 }]}>{s.rank}</Text>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[standingStyles.teamDot, { backgroundColor: s.teamColor }]}>
                      <Text style={standingStyles.teamDotText}>{s.logoInitials}</Text>
                    </View>
                    <Text style={standingStyles.teamNameCell} numberOfLines={1}>{s.teamName}</Text>
                  </View>
                  <Text style={[standingStyles.cell, standingStyles.statCell, { color: c.green }]}>{s.wins}</Text>
                  <Text style={[standingStyles.cell, standingStyles.statCell, { color: "#E8272C" }]}>{s.losses}</Text>
                  <Text style={[standingStyles.cell, standingStyles.statCell]}>{s.ties}</Text>
                  <Text style={[standingStyles.cell, standingStyles.statCell]}>{s.pointsFor}</Text>
                  <Text style={[standingStyles.cell, standingStyles.statCell]}>{s.pointsAgainst}</Text>
                  <Text style={[standingStyles.cell, { width: 38, textAlign: "center" as const, color: s.pointDifferential > 0 ? c.green : s.pointDifferential < 0 ? "#E8272C" : c.textTertiary }]}>
                    {s.pointDifferential > 0 ? "+" : ""}{s.pointDifferential}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registered Teams</Text>
          {tournament.registeredTeams.map((teamId) => {
            const team = teamsMap.get(teamId);
            if (!team) return null;
            return (
              <Pressable
                key={team.id}
                style={styles.teamRow}
                onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
              >
                <View style={[styles.teamAvatar, { backgroundColor: team.color }]}>
                  <Text style={styles.teamAvatarText}>{team.logoInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamRecord}>{team.record.wins}W-{team.record.losses}L | ELO {team.elo}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const gameStyles = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardLive: {
    borderColor: "#E8272C40",
    backgroundColor: "#E8272C06",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 0.5,
    color: c.textTertiary,
  },
  roundLabel: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: c.textTertiary,
    marginLeft: 4,
  },
  fieldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: c.accent + "10",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fieldText: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    color: c.accent,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: c.textTertiary,
  },
  matchup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamDot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  teamDotText: {
    fontSize: 9,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  teamName: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: c.text,
    flex: 1,
  },
  winner: {
    color: c.accent,
  },
  tbd: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: c.textTertiary,
  },
  scoreBox: {
    paddingHorizontal: 12,
    alignItems: "center",
  },
  score: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: c.text,
  },
  vs: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    color: c.textTertiary,
    letterSpacing: 1,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingHorizontal: 16 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface,
    justifyContent: "center", alignItems: "center", marginBottom: 16, marginTop: 12,
  },
  heroCard: { borderRadius: 18, padding: 20, marginBottom: 20, overflow: "hidden" as const },
  viewBracketHeroBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 12,
    marginTop: 16,
  },
  viewBracketHeroBtnLive: {
    backgroundColor: "#fff",
  },
  viewBracketHeroText: {
    fontSize: 14, fontFamily: "Outfit_700Bold", color: "#fff",
  },
  viewBracketHeroTextLive: {
    color: "#5B7AFF",
  },
  statusBadge: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5, marginBottom: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: "Outfit_700Bold", letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontFamily: "Outfit_700Bold", color: c.text, marginBottom: 14, flexShrink: 1 },
  ageGroupPill: {
    backgroundColor: "#F59E0B" + "14",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ageGroupPillText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: "#F59E0B",
    letterSpacing: 0.5,
  },
  heroMeta: { gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaValue: { fontSize: 14, fontFamily: "Outfit_400Regular", color: c.textSecondary },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Outfit_700Bold", color: c.text, marginBottom: 12 },
  descText: { fontSize: 14, fontFamily: "Outfit_400Regular", color: c.textSecondary, lineHeight: 21 },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.accent + "0C",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: c.accent + "25",
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: c.accent,
  },
  teamRow: {
    flexDirection: "row", alignItems: "center", padding: 12,
    backgroundColor: c.surface, borderRadius: 12, marginBottom: 8, gap: 12,
  },
  teamAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  teamAvatarText: { fontSize: 12, fontFamily: "Outfit_700Bold", color: "#fff" },
  teamName: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text },
  teamRecord: { fontSize: 12, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 1 },
  empty: { alignItems: "center", justifyContent: "center", flex: 1, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Outfit_500Medium", color: c.textTertiary },
  championCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: "#FFD70040",
  },
  championGradient: {
    padding: 20,
    alignItems: "center" as const,
  },
  championTrophyRow: {
    marginBottom: 8,
  },
  championLabel: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 2,
    color: "#FFD700",
    marginBottom: 10,
  },
  championTeamRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  championTeamDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  championTeamDotText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  championTeamName: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: c.text,
  },
});

const standingStyles = StyleSheet.create({
  table: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surfaceElevated,
  },
  headerCell: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: c.textTertiary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border + "60",
  },
  rankCell: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: c.textTertiary,
  },
  teamDot: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  teamDotText: {
    fontSize: 8,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  teamNameCell: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: c.text,
    flex: 1,
  },
  statCell: {
    width: 30,
    textAlign: "center" as const,
  },
  cell: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: c.textSecondary,
  },
});

const ageStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  pillActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: c.textSecondary,
  },
  pillTextActive: {
    color: "#fff",
  },
});
