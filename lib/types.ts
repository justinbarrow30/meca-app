export type UserRole = "admin" | "referee" | "coach" | "player" | "spectator";

export interface Player {
  id: string;
  name: string;
  position: string;
  number: number;
  teamId: string;
  avatar?: string;
  stats: PlayerStats;
  elo: number;
  region: string;
}

export interface PlayerStats {
  touchdowns: number;
  interceptions: number;
  gamesPlayed: number;
  wins: number;
  mvpAwards: number;
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  secondaryColor: string;
  region: string;
  elo: number;
  record: { wins: number; losses: number; ties: number };
  roster: string[];
  logoInitials: string;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  location: string;
  region: string;
  status: "upcoming" | "live" | "completed";
  teamCount: number;
  registeredTeams: string[];
  bracket?: Bracket;
  fields: Field[];
  description?: string;
  ageGroup?: string;
}

export interface Field {
  id: string;
  name: string;
  currentMatch?: string;
}

export interface Bracket {
  id: string;
  tournamentId: string;
  rounds: BracketRound[];
  champion?: string;
}

export interface BracketRound {
  roundNumber: number;
  name: string;
  matches: Match[];
}

export interface Match {
  id: string;
  roundNumber: number;
  matchNumber: number;
  roundName?: string;
  team1Id?: string;
  team2Id?: string;
  team1Score?: number;
  team2Score?: number;
  winnerId?: string;
  fieldId?: string;
  fieldName?: string;
  scheduledTime?: string;
  status: "pending" | "live" | "completed";
}

export interface LeaderboardEntry {
  rank: number;
  playerId?: string;
  teamId?: string;
  name: string;
  elo: number;
  change: number;
  region: string;
}

export interface PlayerHighlight {
  id: string;
  playerId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  gameId?: string;
  sortOrder: number;
  createdAt: string;
}

export interface PlayerExternalLink {
  id: string;
  playerId: string;
  platform: string;
  url: string;
  label?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface PlayerRecruitingProfile {
  id: string;
  playerId: string;
  gradYear?: number;
  primaryPosition?: string;
  heightInches?: number;
  weightLbs?: number;
  school?: string;
  contactEmail?: string;
  showContactEmail: boolean;
  bio?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedId?: string;
  relatedType?: string;
  createdAt: string;
}

export interface Event {
  id: string;
  type: "score" | "schedule" | "announcement" | "result";
  title: string;
  description: string;
  timestamp: string;
  tournamentId?: string;
  matchId?: string;
}
