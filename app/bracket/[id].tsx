import React, { useMemo, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useTournament, useTeams } from "@/lib/api-hooks";
import { Match, Team, BracketRound } from "@/lib/types";

const c = Colors.dark;

const ROUND_GAP = 36;
const COLUMN_W = 180;
const LINE_COLOR = c.border;
const DEBUG_DOTS = false;

type CardRect = { x: number; y: number; width: number; height: number };

function BracketMatchBox({
  match,
  teamsMap,
}: {
  match: Match;
  teamsMap: Map<string, Team>;
}) {
  const team1 = teamsMap.get(match.team1Id || "");
  const team2 = teamsMap.get(match.team2Id || "");
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const t1Winner = isCompleted && match.winnerId === team1?.id;
  const t2Winner = isCompleted && match.winnerId === team2?.id;

  return (
    <View style={[bStyles.matchBox, isLive && bStyles.matchBoxLive]}>
      <View style={[bStyles.teamRow, t1Winner && bStyles.winnerRow]}>
        {team1 ? (
          <>
            <View style={[bStyles.teamDot, { backgroundColor: team1.color }]} />
            <Text style={[bStyles.teamLabel, t1Winner && bStyles.winnerLabel]} numberOfLines={1}>
              {team1.name}
            </Text>
          </>
        ) : (
          <Text style={bStyles.tbdLabel}>TBD</Text>
        )}
        <Text style={[bStyles.scoreLabel, t1Winner && bStyles.winnerScoreLabel]}>
          {isLive || isCompleted ? (match.team1Score ?? 0) : "-"}
        </Text>
      </View>
      <View style={bStyles.rowDivider} />
      <View style={[bStyles.teamRow, t2Winner && bStyles.winnerRow]}>
        {team2 ? (
          <>
            <View style={[bStyles.teamDot, { backgroundColor: team2.color }]} />
            <Text style={[bStyles.teamLabel, t2Winner && bStyles.winnerLabel]} numberOfLines={1}>
              {team2.name}
            </Text>
          </>
        ) : (
          <Text style={bStyles.tbdLabel}>TBD</Text>
        )}
        <Text style={[bStyles.scoreLabel, t2Winner && bStyles.winnerScoreLabel]}>
          {isLive || isCompleted ? (match.team2Score ?? 0) : "-"}
        </Text>
      </View>
      {isLive && (
        <View style={bStyles.liveBadge}>
          <View style={bStyles.liveBadgeDot} />
          <Text style={bStyles.liveBadgeText}>LIVE</Text>
        </View>
      )}
    </View>
  );
}

function EmptyMatchBoxContent() {
  return (
    <View style={bStyles.emptyMatchBox}>
      <View style={bStyles.emptyTeamRow}>
        <View style={[bStyles.teamDot, { backgroundColor: c.border }]} />
        <Text style={bStyles.tbdLabel}>TBD</Text>
        <Text style={bStyles.emptyScore}>-</Text>
      </View>
      <View style={bStyles.rowDivider} />
      <View style={bStyles.emptyTeamRow}>
        <View style={[bStyles.teamDot, { backgroundColor: c.border }]} />
        <Text style={bStyles.tbdLabel}>TBD</Text>
        <Text style={bStyles.emptyScore}>-</Text>
      </View>
    </View>
  );
}

function ConnectorOverlay({
  cardRects,
  roundMatchIds,
  containerWidth,
  containerHeight,
}: {
  cardRects: Record<string, CardRect>;
  roundMatchIds: string[][];
  containerWidth: number;
  containerHeight: number;
}) {
  const totalExpected = roundMatchIds.reduce((s, r) => s + r.length, 0);
  const measuredCount = Object.keys(cardRects).length;
  if (measuredCount < totalExpected || totalExpected === 0) return null;

  const allPresent = roundMatchIds.every((ids) => ids.every((id) => cardRects[id]));
  if (!allPresent) return null;

  const lines: React.ReactElement[] = [];
  const dots: React.ReactElement[] = [];
  const halfGap = ROUND_GAP / 2;

  for (let ri = 0; ri < roundMatchIds.length - 1; ri++) {
    const fromIds = roundMatchIds[ri];
    const toIds = roundMatchIds[ri + 1];

    for (let ti = 0; ti < toIds.length; ti++) {
      const srcIdx1 = ti * 2;
      const srcIdx2 = ti * 2 + 1;

      const dstId = toIds[ti];
      const dstRect = cardRects[dstId];
      if (!dstRect) continue;
      const dstAnchorX = dstRect.x;
      const dstAnchorY = dstRect.y + dstRect.height / 2;

      const src1Id = fromIds[srcIdx1];
      if (!src1Id || !cardRects[src1Id]) continue;
      const src1Rect = cardRects[src1Id];
      const src1AnchorX = src1Rect.x + src1Rect.width;
      const src1AnchorY = src1Rect.y + src1Rect.height / 2;

      const midX = src1AnchorX + halfGap;

      lines.push(
        <View
          key={`h1-${ri}-${ti}`}
          style={{
            position: "absolute",
            top: src1AnchorY - 0.5,
            left: src1AnchorX,
            width: halfGap,
            height: 1,
            backgroundColor: LINE_COLOR,
          }}
        />
      );

      if (DEBUG_DOTS) {
        dots.push(
          <View key={`dot-src1-${ri}-${ti}`} style={{ position: "absolute", top: src1AnchorY - 3, left: src1AnchorX - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: "#E8272C" }} />
        );
      }

      if (srcIdx2 < fromIds.length && cardRects[fromIds[srcIdx2]]) {
        const src2Rect = cardRects[fromIds[srcIdx2]];
        const src2AnchorX = src2Rect.x + src2Rect.width;
        const src2AnchorY = src2Rect.y + src2Rect.height / 2;

        lines.push(
          <View
            key={`h2-${ri}-${ti}`}
            style={{
              position: "absolute",
              top: src2AnchorY - 0.5,
              left: src2AnchorX,
              width: halfGap,
              height: 1,
              backgroundColor: LINE_COLOR,
            }}
          />
        );

        if (DEBUG_DOTS) {
          dots.push(
            <View key={`dot-src2-${ri}-${ti}`} style={{ position: "absolute", top: src2AnchorY - 3, left: src2AnchorX - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: "#E8272C" }} />
          );
        }

        const topY = Math.min(src1AnchorY, src2AnchorY);
        const bottomY = Math.max(src1AnchorY, src2AnchorY);
        lines.push(
          <View
            key={`v-${ri}-${ti}`}
            style={{
              position: "absolute",
              top: topY,
              left: midX - 0.5,
              width: 1,
              height: bottomY - topY,
              backgroundColor: LINE_COLOR,
            }}
          />
        );
      }

      lines.push(
        <View
          key={`hd-${ri}-${ti}`}
          style={{
            position: "absolute",
            top: dstAnchorY - 0.5,
            left: midX,
            width: dstAnchorX - midX,
            height: 1,
            backgroundColor: LINE_COLOR,
          }}
        />
      );

      if (DEBUG_DOTS) {
        dots.push(
          <View key={`dot-dst-${ri}-${ti}`} style={{ position: "absolute", top: dstAnchorY - 3, left: dstAnchorX - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: "#5B7AFF" }} />
        );
      }
    }
  }

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
      }}
      pointerEvents="none"
    >
      {lines}
      {dots}
    </View>
  );
}

function MarchMadnessBracket({
  rounds,
  teamsMap,
  champion,
}: {
  rounds: BracketRound[];
  teamsMap: Map<string, Team>;
  champion?: string;
}) {
  const elimRounds = useMemo(() => {
    const elimNames = ["wildcard", "quarterfinal", "semifinal", "championship", "final", "round of 16", "first round"];
    return rounds.filter((r) => {
      const name = r.name.toLowerCase();
      return elimNames.some((e) => name.includes(e)) || !name.includes("pool");
    });
  }, [rounds]);

  const displayRounds = elimRounds.length > 0 ? elimRounds : rounds;

  const [cardRectsLocal, setCardRectsLocal] = useState<Record<string, CardRect>>({});
  const [columnOffsets, setColumnOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const [cardsAreaOffsets, setCardsAreaOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleCardLayout = useCallback(
    (matchId: string, e: LayoutChangeEvent) => {
      const { x, y, width, height } = e.nativeEvent.layout;
      setCardRectsLocal((prev) => {
        const existing = prev[matchId];
        if (
          existing &&
          Math.abs(existing.x - x) < 1 &&
          Math.abs(existing.y - y) < 1 &&
          Math.abs(existing.width - width) < 1 &&
          Math.abs(existing.height - height) < 1
        ) {
          return prev;
        }
        return { ...prev, [matchId]: { x, y, width, height } };
      });
    },
    []
  );

  const handleColumnLayout = useCallback(
    (ri: number, e: LayoutChangeEvent) => {
      const { x, y } = e.nativeEvent.layout;
      setColumnOffsets((prev) => {
        const existing = prev[ri];
        if (existing && Math.abs(existing.x - x) < 1 && Math.abs(existing.y - y) < 1) return prev;
        return { ...prev, [ri]: { x, y } };
      });
    },
    []
  );

  const handleCardsAreaLayout = useCallback(
    (ri: number, e: LayoutChangeEvent) => {
      const { x, y } = e.nativeEvent.layout;
      setCardsAreaOffsets((prev) => {
        const existing = prev[ri];
        if (existing && Math.abs(existing.x - x) < 1 && Math.abs(existing.y - y) < 1) return prev;
        return { ...prev, [ri]: { x, y } };
      });
    },
    []
  );

  const roundMatchIds = useMemo(
    () => displayRounds.map((r) => r.matches.map((m) => m.id)),
    [displayRounds]
  );

  const cardRects = useMemo(() => {
    const allColumnsReady = displayRounds.every((_, ri) => columnOffsets[ri] && cardsAreaOffsets[ri]);
    if (!allColumnsReady) return {};

    const result: Record<string, CardRect> = {};
    displayRounds.forEach((round, ri) => {
      const colOff = columnOffsets[ri];
      const areaOff = cardsAreaOffsets[ri];
      round.matches.forEach((match) => {
        const local = cardRectsLocal[match.id];
        if (!local) return;
        result[match.id] = {
          x: colOff.x + areaOff.x + local.x,
          y: colOff.y + areaOff.y + local.y,
          width: local.width,
          height: local.height,
        };
      });
    });
    return result;
  }, [cardRectsLocal, columnOffsets, cardsAreaOffsets, displayRounds]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: 24 }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "flex-start" }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setContainerSize((prev) => {
            if (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) return prev;
            return { width, height };
          });
        }}
      >
        {displayRounds.map((round, ri) => (
          <React.Fragment key={round.name}>
            <View
              style={{ width: COLUMN_W }}
              onLayout={(e) => handleColumnLayout(ri, e)}
            >
              <View style={bStyles.roundHeaderBox}>
                <Text style={bStyles.roundTitle}>{round.name}</Text>
              </View>
              <View
                style={{ justifyContent: "space-around", flex: 1, minHeight: 200 }}
                onLayout={(e) => handleCardsAreaLayout(ri, e)}
              >
                {round.matches.map((match) => (
                  <View
                    key={match.id}
                    onLayout={(e) => handleCardLayout(match.id, e)}
                    style={{ alignItems: "center", justifyContent: "center" }}
                  >
                    <BracketMatchBox match={match} teamsMap={teamsMap} />
                  </View>
                ))}
              </View>
            </View>
            {ri < displayRounds.length - 1 && (
              <View style={{ width: ROUND_GAP }} />
            )}
          </React.Fragment>
        ))}

        {champion && (
          <>
            <View style={{ width: ROUND_GAP }} />
            <View style={{ width: COLUMN_W }}>
              <View style={bStyles.roundHeaderBox}>
                <Text style={bStyles.roundTitle}>Champion</Text>
              </View>
              <View style={{ flex: 1, minHeight: 200, justifyContent: "center", alignItems: "center" }}>
                <View style={bStyles.championBox}>
                  <Ionicons name="trophy" size={22} color="#D4A84B" />
                  <Text style={bStyles.championName}>{teamsMap.get(champion)?.name || "TBD"}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <ConnectorOverlay
          cardRects={cardRects}
          roundMatchIds={roundMatchIds}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      </View>
    </ScrollView>
  );
}

function EmptyBracket({ teamCount }: { teamCount: number }) {
  const count = teamCount || 10;

  const roundDefs = useMemo(() => {
    const defs: { name: string; count: number }[] = [];
    if (count <= 4) {
      defs.push({ name: "Semifinal", count: Math.min(count, 2) });
    } else if (count === 6) {
      defs.push({ name: "First Round", count: 2 });
      defs.push({ name: "Semifinal", count: 2 });
    } else if (count <= 8) {
      defs.push({ name: "Quarterfinal", count: 4 });
      defs.push({ name: "Semifinal", count: 2 });
    } else if (count <= 14) {
      const wcCount = count <= 10 ? 2 : count <= 12 ? 4 : 6;
      defs.push({ name: "Wildcard", count: wcCount });
      defs.push({ name: "Quarterfinal", count: 4 });
      defs.push({ name: "Semifinal", count: 2 });
    } else {
      defs.push({ name: "Round of 16", count: 8 });
      defs.push({ name: "Quarterfinal", count: 4 });
      defs.push({ name: "Semifinal", count: 2 });
    }
    defs.push({ name: "Championship", count: 1 });
    return defs;
  }, [count]);

  const [cardRectsLocal, setCardRectsLocal] = useState<Record<string, CardRect>>({});
  const [columnOffsets, setColumnOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const [cardsAreaOffsets, setCardsAreaOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleCardLayout = useCallback(
    (matchId: string, e: LayoutChangeEvent) => {
      const { x, y, width, height } = e.nativeEvent.layout;
      setCardRectsLocal((prev) => {
        const existing = prev[matchId];
        if (
          existing &&
          Math.abs(existing.x - x) < 1 &&
          Math.abs(existing.y - y) < 1 &&
          Math.abs(existing.width - width) < 1 &&
          Math.abs(existing.height - height) < 1
        ) {
          return prev;
        }
        return { ...prev, [matchId]: { x, y, width, height } };
      });
    },
    []
  );

  const handleColumnLayout = useCallback(
    (ri: number, e: LayoutChangeEvent) => {
      const { x, y } = e.nativeEvent.layout;
      setColumnOffsets((prev) => {
        const existing = prev[ri];
        if (existing && Math.abs(existing.x - x) < 1 && Math.abs(existing.y - y) < 1) return prev;
        return { ...prev, [ri]: { x, y } };
      });
    },
    []
  );

  const handleCardsAreaLayout = useCallback(
    (ri: number, e: LayoutChangeEvent) => {
      const { x, y } = e.nativeEvent.layout;
      setCardsAreaOffsets((prev) => {
        const existing = prev[ri];
        if (existing && Math.abs(existing.x - x) < 1 && Math.abs(existing.y - y) < 1) return prev;
        return { ...prev, [ri]: { x, y } };
      });
    },
    []
  );

  const matchIdsByRound = useMemo(
    () => roundDefs.map((r) => Array.from({ length: r.count }, (_, i) => `${r.name}-${i}`)),
    [roundDefs]
  );

  const cardRects = useMemo(() => {
    const allColumnsReady = roundDefs.every((_, ri) => columnOffsets[ri] && cardsAreaOffsets[ri]);
    if (!allColumnsReady) return {};

    const result: Record<string, CardRect> = {};
    roundDefs.forEach((round, ri) => {
      const colOff = columnOffsets[ri];
      const areaOff = cardsAreaOffsets[ri];
      const ids = matchIdsByRound[ri];
      ids.forEach((mid) => {
        const local = cardRectsLocal[mid];
        if (!local) return;
        result[mid] = {
          x: colOff.x + areaOff.x + local.x,
          y: colOff.y + areaOff.y + local.y,
          width: local.width,
          height: local.height,
        };
      });
    });
    return result;
  }, [cardRectsLocal, columnOffsets, cardsAreaOffsets, roundDefs, matchIdsByRound]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: 24 }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "flex-start" }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setContainerSize((prev) => {
            if (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) return prev;
            return { width, height };
          });
        }}
      >
        {roundDefs.map((round, ri) => {
          const matchIds = matchIdsByRound[ri];
          return (
            <React.Fragment key={round.name}>
              <View
                style={{ width: COLUMN_W }}
                onLayout={(e) => handleColumnLayout(ri, e)}
              >
                <View style={bStyles.roundHeaderBox}>
                  <Text style={bStyles.roundTitle}>{round.name}</Text>
                </View>
                <View
                  style={{ justifyContent: "space-around", flex: 1, minHeight: 200 }}
                  onLayout={(e) => handleCardsAreaLayout(ri, e)}
                >
                  {matchIds.map((mid) => (
                    <View
                      key={mid}
                      onLayout={(e) => handleCardLayout(mid, e)}
                      style={{ alignItems: "center", justifyContent: "center" }}
                    >
                      <EmptyMatchBoxContent />
                    </View>
                  ))}
                </View>
              </View>
              {ri < roundDefs.length - 1 && <View style={{ width: ROUND_GAP }} />}
            </React.Fragment>
          );
        })}
        <View style={{ width: ROUND_GAP }} />
        <View style={{ width: COLUMN_W }}>
          <View style={bStyles.roundHeaderBox}>
            <Text style={bStyles.roundTitle}>Champion</Text>
          </View>
          <View style={{ flex: 1, minHeight: 200, justifyContent: "center", alignItems: "center" }}>
            <View style={bStyles.championBox}>
              <Ionicons name="trophy" size={22} color={c.border} />
              <Text style={[bStyles.championName, { color: c.textTertiary }]}>TBD</Text>
            </View>
          </View>
        </View>

        <ConnectorOverlay
          cardRects={cardRects}
          roundMatchIds={matchIdsByRound}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      </View>
    </ScrollView>
  );
}

function MatchCard({ match, teamsMap }: { match: Match; teamsMap: Map<string, Team> }) {
  const team1 = teamsMap.get(match.team1Id || "");
  const team2 = teamsMap.get(match.team2Id || "");
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";

  return (
    <Pressable
      style={[styles.matchCard, isLive && styles.matchCardLive]}
      onPress={() => router.push({ pathname: "/game/[id]", params: { id: match.id } })}
    >
      {isLive && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
      )}

      <View style={styles.matchTeamRow}>
        <View style={styles.matchTeamInfo}>
          {team1 ? (
            <>
              <View style={[styles.miniLogo, { backgroundColor: team1.color }]}>
                <Text style={styles.miniLogoText}>{team1.logoInitials}</Text>
              </View>
              <Text style={[styles.matchTeamName, isCompleted && match.winnerId === team1.id && styles.winnerText]} numberOfLines={1}>
                {team1.name}
              </Text>
            </>
          ) : (
            <Text style={styles.tbd}>TBD</Text>
          )}
        </View>
        <Text style={[styles.matchScore, isCompleted && match.winnerId === team1?.id && styles.winnerScore]}>
          {match.team1Score ?? "-"}
        </Text>
      </View>

      <View style={styles.matchDivider} />

      <View style={styles.matchTeamRow}>
        <View style={styles.matchTeamInfo}>
          {team2 ? (
            <>
              <View style={[styles.miniLogo, { backgroundColor: team2.color }]}>
                <Text style={styles.miniLogoText}>{team2.logoInitials}</Text>
              </View>
              <Text style={[styles.matchTeamName, isCompleted && match.winnerId === team2.id && styles.winnerText]} numberOfLines={1}>
                {team2.name}
              </Text>
            </>
          ) : (
            <Text style={styles.tbd}>TBD</Text>
          )}
        </View>
        <Text style={[styles.matchScore, isCompleted && match.winnerId === team2?.id && styles.winnerScore]}>
          {match.team2Score ?? "-"}
        </Text>
      </View>

      {(match.scheduledTime || match.fieldName) && (
        <View style={styles.matchFooter}>
          {match.scheduledTime && (
            <>
              <Ionicons name="time-outline" size={11} color={c.textTertiary} />
              <Text style={styles.matchTime}>{match.scheduledTime}</Text>
            </>
          )}
          {match.fieldName && (
            <>
              {match.scheduledTime && <Text style={styles.matchTimeDivider}>|</Text>}
              <Ionicons name="football-outline" size={11} color={c.textTertiary} />
              <Text style={styles.matchTime}>{match.fieldName}</Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function BracketScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [viewMode, setViewMode] = useState<"games" | "bracket">(tab === "bracket" ? "bracket" : "games");

  const { data: tournament, isLoading: tournamentLoading } = useTournament(id || "");
  const { data: teams = [], isLoading: teamsLoading } = useTeams();

  const isLoading = tournamentLoading || teamsLoading;

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

  const hasBracket = tournament?.bracket && tournament.bracket.rounds.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{viewMode === "games" ? "All Games" : "Bracket"}</Text>
            <Text style={styles.headerSub}>{tournament?.name || "Tournament"}</Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, viewMode === "games" && styles.toggleBtnActive]}
            onPress={() => setViewMode("games")}
          >
            <Ionicons name="list" size={16} color={viewMode === "games" ? "#fff" : c.textSecondary} />
            <Text style={[styles.toggleText, viewMode === "games" && styles.toggleTextActive]}>All Games</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, viewMode === "bracket" && styles.toggleBtnActive]}
            onPress={() => setViewMode("bracket")}
          >
            <Ionicons name="git-network-outline" size={16} color={viewMode === "bracket" ? "#fff" : c.textSecondary} />
            <Text style={[styles.toggleText, viewMode === "bracket" && styles.toggleTextActive]}>Bracket</Text>
          </Pressable>
        </View>

        {viewMode === "bracket" ? (
          hasBracket ? (
            <MarchMadnessBracket
              rounds={tournament!.bracket!.rounds}
              teamsMap={teamsMap}
              champion={tournament!.bracket!.champion}
            />
          ) : (
            <EmptyBracket teamCount={tournament?.teamCount || 10} />
          )
        ) : (
          <>
            {hasBracket ? (
              tournament!.bracket!.rounds.map((round) => (
                <View key={round.name} style={styles.roundSection}>
                  <View style={styles.roundHeader}>
                    <View style={styles.roundLine} />
                    <Text style={styles.roundName}>{round.name}</Text>
                    <View style={styles.roundLine} />
                  </View>
                  <View style={styles.matchesGrid}>
                    {[...round.matches].sort((a, b) => {
                      const order: Record<string, number> = { live: 0, pending: 1, completed: 2 };
                      return (order[a.status] ?? 1) - (order[b.status] ?? 1);
                    }).map((match) => (
                      <MatchCard key={match.id} match={match} teamsMap={teamsMap} />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.empty}>
                <Ionicons name="football-outline" size={40} color={c.textTertiary} />
                <Text style={styles.emptyText}>No games scheduled yet</Text>
                <Text style={[styles.emptyText, { fontSize: 13 }]}>Games will appear here once the bracket is set</Text>
              </View>
            )}
          </>
        )}

        {hasBracket && tournament!.bracket!.champion && viewMode === "games" && (
          <View style={styles.championSection}>
            <Ionicons name="trophy" size={28} color="#D4A84B" />
            <Text style={styles.championTitle}>Champion</Text>
            <Text style={styles.championNameBottom}>{teamsMap.get(tournament!.bracket!.champion)?.name || "TBD"}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const bStyles = StyleSheet.create({
  roundHeaderBox: {
    backgroundColor: c.accent + "10",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  roundTitle: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: c.accent,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  matchBox: {
    width: COLUMN_W - 8,
    backgroundColor: c.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden" as const,
  },
  matchBoxLive: { borderColor: "#E8272C60" },
  emptyMatchBox: {
    width: COLUMN_W - 8,
    backgroundColor: c.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: "dashed" as const,
    overflow: "hidden" as const,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  emptyTeamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  winnerRow: { backgroundColor: c.green + "0A" },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  teamLabel: { fontSize: 11, fontFamily: "Outfit_600SemiBold", color: c.text, flex: 1 },
  winnerLabel: { color: c.green },
  tbdLabel: { fontSize: 11, fontFamily: "Outfit_500Medium", color: c.textTertiary, flex: 1, fontStyle: "italic" as const },
  scoreLabel: { fontSize: 12, fontFamily: "Outfit_700Bold", color: c.textSecondary, minWidth: 16, textAlign: "right" as const },
  winnerScoreLabel: { color: c.green },
  emptyScore: { fontSize: 12, fontFamily: "Outfit_700Bold", color: c.border, minWidth: 16, textAlign: "right" as const },
  rowDivider: { height: 1, backgroundColor: c.borderLight },
  liveBadge: {
    position: "absolute" as const,
    top: -1,
    right: -1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E8272C",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 7,
  },
  liveBadgeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" },
  liveBadgeText: { fontSize: 7, fontFamily: "Outfit_700Bold", color: "#fff", letterSpacing: 0.4 },
  championBox: {
    backgroundColor: "#FFD93D" + "18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD93D" + "40",
    padding: 14,
    alignItems: "center",
    gap: 6,
    width: COLUMN_W - 8,
  },
  championName: { fontSize: 13, fontFamily: "Outfit_700Bold", color: c.text, textAlign: "center" as const },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingTop: 12, marginBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontFamily: "Outfit_700Bold", color: c.text },
  headerSub: { fontSize: 13, fontFamily: "Outfit_400Regular", color: c.textTertiary, marginTop: 1 },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  toggleBtnActive: { backgroundColor: c.accent },
  toggleText: { fontSize: 13, fontFamily: "Outfit_600SemiBold", color: c.textSecondary },
  toggleTextActive: { color: "#fff" },
  roundSection: { marginBottom: 24 },
  roundHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  roundLine: { flex: 1, height: 1, backgroundColor: c.border },
  roundName: {
    fontSize: 13, fontFamily: "Outfit_700Bold", color: c.textSecondary,
    letterSpacing: 1, textTransform: "uppercase" as const,
  },
  matchesGrid: { gap: 10 },
  matchCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: c.border,
  },
  matchCardLive: {
    borderColor: c.accent + "40", backgroundColor: c.accent + "08",
  },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#E8272C" },
  liveLabel: { fontSize: 10, fontFamily: "Outfit_700Bold", color: "#E8272C", letterSpacing: 1 },
  matchTeamRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6,
  },
  matchTeamInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  miniLogo: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  miniLogoText: { fontSize: 9, fontFamily: "Outfit_700Bold", color: "#fff" },
  matchTeamName: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: c.text },
  winnerText: { color: c.green },
  tbd: { fontSize: 14, fontFamily: "Outfit_500Medium", color: c.textTertiary, fontStyle: "italic" as const },
  matchScore: {
    fontSize: 18, fontFamily: "Outfit_700Bold", color: c.textSecondary,
    minWidth: 24, textAlign: "right" as const,
  },
  winnerScore: { color: c.green },
  matchDivider: { height: 1, backgroundColor: c.borderLight, marginVertical: 2 },
  matchFooter: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  matchTime: { fontSize: 11, fontFamily: "Outfit_400Regular", color: c.textTertiary },
  matchTimeDivider: { color: c.border, fontSize: 10 },
  championSection: {
    alignItems: "center", padding: 24, backgroundColor: c.surface,
    borderRadius: 16, marginTop: 8, gap: 6,
    borderWidth: 1, borderColor: "#FFD93D" + "30",
  },
  championTitle: { fontSize: 11, fontFamily: "Outfit_700Bold", color: c.textTertiary, letterSpacing: 1.5, textTransform: "uppercase" as const },
  championNameBottom: { fontSize: 18, fontFamily: "Outfit_700Bold", color: c.text },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Outfit_500Medium", color: c.textSecondary, textAlign: "center" as const },
});
