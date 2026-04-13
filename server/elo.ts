import { db } from "./db";
import { teams, players } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@shared/schema";

const K_TEAM = 32;
const K_PLAYER = 40;

export interface TeamEloResult {
  winnerNewElo: number;
  loserNewElo: number;
  winnerChange: number;
  loserChange: number;
}

export function calculateTeamElo(
  winnerElo: number,
  loserElo: number,
  winnerScore: number,
  loserScore: number
): TeamEloResult {
  const expectedScore = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const actualScore = 1;

  const pointDifferential = Math.abs(winnerScore - loserScore) || 1;
  const marginMultiplier = Math.log(pointDifferential + 1);
  const ratingDifference = Math.abs(winnerElo - loserElo);
  const scalingFactor = 2.2 / (ratingDifference * 0.001 + 2.2);
  const finalMarginMultiplier = Math.min(2.5, Math.max(1.0, marginMultiplier * scalingFactor));

  const winnerChange = Math.min(60, Math.max(-60, Math.round(
    K_TEAM * finalMarginMultiplier * (actualScore - expectedScore)
  )));

  const loserExpected = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  const loserChange = Math.min(60, Math.max(-60, Math.round(
    K_TEAM * finalMarginMultiplier * (0 - loserExpected)
  )));

  return {
    winnerNewElo: winnerElo + winnerChange,
    loserNewElo: loserElo + loserChange,
    winnerChange,
    loserChange,
  };
}

export interface PlayerEloInput {
  playerElo: number;
  touchdowns: number;
  interceptions: number;
  opponentTeamElo: number;
  teamWon: boolean;
  leagueAverageImpactScore: number;
}

export interface PlayerEloResult {
  newElo: number;
  change: number;
}

export function calculatePlayerElo(input: PlayerEloInput): PlayerEloResult {
  const {
    playerElo,
    touchdowns,
    interceptions,
    opponentTeamElo,
    teamWon,
    leagueAverageImpactScore,
  } = input;

  const impactScore = (touchdowns * 6) - (interceptions * 4);

  const avgImpact = leagueAverageImpactScore || 6;
  const normalizedPerformance = Math.min(2, Math.max(0, impactScore / avgImpact));
  const performanceScore = normalizedPerformance / 2;

  const difficultyMultiplier = Math.min(1.15, Math.max(0.85,
    1 + (opponentTeamElo - 1500) / 2000
  ));

  const teamModifier = teamWon ? 1.05 : 0.95;

  const ratingChange = Math.min(50, Math.max(-50, Math.round(
    K_PLAYER * (performanceScore - 0.5) * difficultyMultiplier * teamModifier
  )));

  return {
    newElo: playerElo + ratingChange,
    change: ratingChange,
  };
}

export async function processTeamEloUpdate(
  winnerId: string,
  loserId: string,
  winnerScore: number,
  loserScore: number,
  tx?: NodePgDatabase<typeof schema>
): Promise<TeamEloResult> {
  const d = tx || db;
  const [winner] = await d.select().from(teams).where(eq(teams.id, winnerId));
  const [loser] = await d.select().from(teams).where(eq(teams.id, loserId));

  if (!winner || !loser) {
    throw new Error("Winner or loser team not found");
  }

  const result = calculateTeamElo(winner.elo, loser.elo, winnerScore, loserScore);

  await d.update(teams).set({
    elo: result.winnerNewElo,
    wins: winner.wins + 1,
    updatedAt: new Date(),
  }).where(eq(teams.id, winnerId));

  await d.update(teams).set({
    elo: result.loserNewElo,
    losses: loser.losses + 1,
    updatedAt: new Date(),
  }).where(eq(teams.id, loserId));

  return result;
}

export async function processPlayerEloUpdate(
  winnerId: string,
  loserId: string,
  winnerScore: number,
  loserScore: number,
  tx?: NodePgDatabase<typeof schema>
): Promise<void> {
  const d = tx || db;
  const [winnerTeam] = await d.select().from(teams).where(eq(teams.id, winnerId));
  const [loserTeam] = await d.select().from(teams).where(eq(teams.id, loserId));

  if (!winnerTeam || !loserTeam) return;

  const winnerPlayers = await d.select().from(players).where(eq(players.teamId, winnerId));
  const loserPlayers = await d.select().from(players).where(eq(players.teamId, loserId));
  const allPlayers = [...winnerPlayers, ...loserPlayers];

  const totalImpact = allPlayers.reduce((sum, p) => {
    return sum + Math.abs((p.touchdowns * 6) - (p.interceptions * 4));
  }, 0);
  const leagueAvg = allPlayers.length > 0 ? totalImpact / allPlayers.length : 6;

  for (const p of winnerPlayers) {
    const result = calculatePlayerElo({
      playerElo: p.elo,
      touchdowns: p.touchdowns,
      interceptions: p.interceptions,
      opponentTeamElo: loserTeam.elo,
      teamWon: true,
      leagueAverageImpactScore: leagueAvg,
    });

    await d.update(players).set({
      elo: result.newElo,
      gamesPlayed: p.gamesPlayed + 1,
      updatedAt: new Date(),
    }).where(eq(players.id, p.id));
  }

  for (const p of loserPlayers) {
    const result = calculatePlayerElo({
      playerElo: p.elo,
      touchdowns: p.touchdowns,
      interceptions: p.interceptions,
      opponentTeamElo: winnerTeam.elo,
      teamWon: false,
      leagueAverageImpactScore: leagueAvg,
    });

    await d.update(players).set({
      elo: result.newElo,
      gamesPlayed: p.gamesPlayed + 1,
      updatedAt: new Date(),
    }).where(eq(players.id, p.id));
  }
}

export async function applyTournamentMvpBonus(playerId: string): Promise<number> {
  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) throw new Error("Player not found");

  const newElo = player.elo + 25;
  await db.update(players).set({
    elo: newElo,
    mvpAwards: player.mvpAwards + 1,
    updatedAt: new Date(),
  }).where(eq(players.id, playerId));

  return newElo;
}
