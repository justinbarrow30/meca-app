import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./query-client";
import type { Player, Team, Tournament, Match, Event, LeaderboardEntry, Bracket, BracketRound, PlayerHighlight, PlayerExternalLink, PlayerRecruitingProfile, Notification } from "./types";

function mapTeam(t: any): Team {
  return {
    id: t.id,
    name: t.name,
    abbreviation: t.abbreviation,
    color: t.color,
    secondaryColor: t.secondaryColor || "#1A1D2B",
    region: t.region,
    elo: Math.round(t.elo),
    record: { wins: t.wins, losses: t.losses, ties: t.ties },
    roster: t.roster?.map((p: any) => p.id) || [],
    logoInitials: t.logoInitials || t.abbreviation?.slice(0, 3) || "",
  };
}

function mapPlayer(p: any): Player {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    number: p.number,
    teamId: p.teamId,
    elo: Math.round(p.elo),
    region: p.region,
    stats: {
      touchdowns: p.touchdowns,
      interceptions: p.interceptions,
      gamesPlayed: p.gamesPlayed,
      wins: p.wins || 0,
      mvpAwards: p.mvpAwards,
    },
  };
}

function mapGame(g: any, fieldsMap?: Map<string, string>): Match {
  return {
    id: g.id,
    roundNumber: g.roundNumber,
    matchNumber: g.matchNumber,
    roundName: g.roundName || undefined,
    team1Id: g.teamAId || undefined,
    team2Id: g.teamBId || undefined,
    team1Score: g.scoreA ?? undefined,
    team2Score: g.scoreB ?? undefined,
    winnerId: g.winnerId || undefined,
    fieldId: g.fieldId || undefined,
    fieldName: g.fieldId && fieldsMap ? fieldsMap.get(g.fieldId) : undefined,
    scheduledTime: g.scheduledTime
      ? new Date(g.scheduledTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : undefined,
    status: g.status === "final" || g.status === "locked" ? "completed" : g.status === "live" ? "live" : "pending",
  };
}

function mapTournament(t: any, teams?: Team[]): Tournament {
  const fieldsMap = new Map<string, string>();
  if (t.fields) {
    for (const f of t.fields) {
      fieldsMap.set(f.id, f.name);
    }
  }

  let bracket: Bracket | undefined;
  if (t.bracket) {
    const rounds: BracketRound[] = t.bracket.rounds.map((r: any) => ({
      roundNumber: r.roundNumber,
      name: r.name,
      matches: r.matches.map((g: any) => mapGame(g, fieldsMap)),
    }));

    let champion: string | undefined;
    if (t.bracket.champion) {
      const champNames = ["championship", "final"];
      const champRound = rounds.find((r) => champNames.some((cn) => r.name.toLowerCase().includes(cn)));
      if (champRound) {
        const champGame = champRound.matches[champRound.matches.length - 1];
        if (champGame && champGame.status === "completed" && champGame.winnerId) {
          champion = t.bracket.champion;
        }
      } else {
        const lastRound = rounds[rounds.length - 1];
        if (lastRound) {
          const lastGame = lastRound.matches[lastRound.matches.length - 1];
          if (lastGame && lastGame.status === "completed" && lastGame.winnerId) {
            champion = t.bracket.champion;
          }
        }
      }
    }

    bracket = {
      id: t.bracket.id,
      tournamentId: t.id,
      rounds,
      champion,
    };
  }

  return {
    id: t.id,
    name: t.name,
    date: t.startDate,
    endDate: t.endDate || undefined,
    location: t.location,
    region: t.region,
    status: t.status === "draft" ? "upcoming" : t.status === "cancelled" ? "completed" : t.status,
    teamCount: t.teamCount,
    registeredTeams: t.registeredTeams || [],
    bracket,
    fields: (t.fields || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      currentMatch: f.currentGameId || undefined,
    })),
    description: t.description || undefined,
    ageGroup: t.ageGroup || undefined,
  };
}

function mapEvent(e: any): Event {
  return {
    id: e.id,
    type: e.type as Event["type"],
    title: e.title,
    description: e.description,
    timestamp: e.createdAt,
    tournamentId: e.tournamentId || undefined,
    matchId: e.gameId || undefined,
  };
}

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ["/api/teams"],
    select: (data: any) => (data as any[]).map(mapTeam),
  });
}

export function useTeam(id: string) {
  return useQuery<Team>({
    queryKey: ["/api/teams", id],
    select: (data: any) => mapTeam(data),
    enabled: !!id,
  });
}

export function useTeamPlayers(teamId: string) {
  return useQuery<Player[]>({
    queryKey: ["/api/teams", teamId],
    select: (data: any) => (data.roster || []).map(mapPlayer),
    enabled: !!teamId,
  });
}

export function usePlayers() {
  return useQuery<Player[]>({
    queryKey: ["/api/players"],
    select: (data: any) => (data as any[]).map(mapPlayer),
  });
}

export function useAvailablePlayers() {
  return useQuery<Player[]>({
    queryKey: ["/api/players/available"],
    select: (data: any) => (data as any[]).map(mapPlayer),
  });
}

export function usePlayer(id: string) {
  return useQuery<Player>({
    queryKey: ["/api/players", id],
    select: (data: any) => mapPlayer(data),
    enabled: !!id,
  });
}

export function useTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
    select: (data: any) => (data as any[]).map((t: any) => mapTournament(t)),
    refetchInterval: 10000,
  });
}

export function useTournament(id: string) {
  return useQuery<Tournament>({
    queryKey: ["/api/tournaments", id],
    select: (data: any) => mapTournament(data),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export interface TournamentSibling {
  id: string;
  name: string;
  ageGroup: string | null;
  status: string;
}

export function useTournamentSiblings(id: string) {
  return useQuery<TournamentSibling[]>({
    queryKey: [`/api/tournaments/${id}/siblings`],
    enabled: !!id,
  });
}

export function useTeamRankings(region?: string, ageGroup?: string) {
  const params = new URLSearchParams();
  if (region && region !== "all") params.set("region", region);
  if (ageGroup && ageGroup !== "all") params.set("ageGroup", ageGroup);
  const qs = params.toString();
  const queryKey = ["/api/rankings/teams" + (qs ? "?" + qs : "")];
  return useQuery<LeaderboardEntry[]>({
    queryKey,
    select: (data: any) => data as LeaderboardEntry[],
  });
}

export function usePlayerRankings(region?: string, ageGroup?: string) {
  const params = new URLSearchParams();
  if (region && region !== "all") params.set("region", region);
  if (ageGroup && ageGroup !== "all") params.set("ageGroup", ageGroup);
  const qs = params.toString();
  const queryKey = ["/api/rankings/players" + (qs ? "?" + qs : "")];
  return useQuery<LeaderboardEntry[]>({
    queryKey,
    select: (data: any) => data as LeaderboardEntry[],
  });
}

export interface TournamentStanding {
  rank: number;
  teamId: string;
  teamName: string;
  teamColor: string;
  logoInitials: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  gamesPlayed: number;
}

export function useTournamentStandings(tournamentId: string) {
  return useQuery<TournamentStanding[]>({
    queryKey: [`/api/tournaments/${tournamentId}/standings`],
    enabled: !!tournamentId,
    refetchInterval: 10000,
  });
}

export function useGame(id: string) {
  return useQuery({
    queryKey: ["/api/games", id],
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return data?.status === "live" ? 5000 : false;
    },
  });
}

export function useActivity() {
  return useQuery<Event[]>({
    queryKey: ["/api/activity"],
    select: (data: any) => (data as any[]).map(mapEvent),
    refetchInterval: 10000,
  });
}

export function usePlayerHighlights(playerId: string) {
  return useQuery<PlayerHighlight[]>({
    queryKey: ["/api/players", playerId, "highlights"],
    enabled: !!playerId,
  });
}

export function usePlayerExternalLinks(playerId: string) {
  return useQuery<PlayerExternalLink[]>({
    queryKey: ["/api/players", playerId, "external-links"],
    enabled: !!playerId,
  });
}

export function usePlayerRecruiting(playerId: string) {
  return useQuery<PlayerRecruitingProfile | null>({
    queryKey: ["/api/players", playerId, "recruiting"],
    enabled: !!playerId,
  });
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 15000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      await apiRequest("PUT", "/api/notifications/mark-read", ids ? { ids } : {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });
}

export function usePlayerBadges(playerId: string) {
  return useQuery<{ id: string; playerId: string; badgeType: string; note: string | null; awardedBy: string | null; createdAt: string }[]>({
    queryKey: ["/api/players", playerId, "badges"],
    queryFn: async () => {
      const { getApiUrl } = await import("./query-client");
      const res = await fetch(new URL(`/api/players/${playerId}/badges`, getApiUrl()).toString());
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json();
    },
    enabled: !!playerId,
  });
}

export function useMyFollows() {
  return useQuery<{ id: string; targetType: string; targetId: string; createdAt: string }[]>({
    queryKey: ["/api/follows/me"],
  });
}

export function useFollowCheck(targetType: string, targetId: string) {
  return useQuery<{ following: boolean }>({
    queryKey: ["/api/follows/check", targetType, targetId],
    enabled: !!targetType && !!targetId,
  });
}

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetType, targetId }: { targetType: string; targetId: string }) => {
      await apiRequest("POST", "/api/follows", { targetType, targetId });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/follows/me"] });
      qc.invalidateQueries({ queryKey: ["/api/follows/check", vars.targetType, vars.targetId] });
    },
  });
}

export function useUnfollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetType, targetId }: { targetType: string; targetId: string }) => {
      await apiRequest("DELETE", `/api/follows/${targetType}/${targetId}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/follows/me"] });
      qc.invalidateQueries({ queryKey: ["/api/follows/check", vars.targetType, vars.targetId] });
    },
  });
}
