import { Player, Team, Tournament, Match, Event, LeaderboardEntry, Bracket } from "./types";

export const TEAMS: Team[] = [
  {
    id: "t1", name: "East Side Titans", abbreviation: "EST", color: "#E8272C", secondaryColor: "#1A1A2E",
    region: "Northeast", elo: 1580, record: { wins: 14, losses: 3, ties: 0 }, roster: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"], logoInitials: "ET",
  },
  {
    id: "t2", name: "DMV Wolves", abbreviation: "DMV", color: "#3B82F6", secondaryColor: "#0F172A",
    region: "Mid-Atlantic", elo: 1545, record: { wins: 12, losses: 4, ties: 1 }, roster: ["p8", "p9", "p10", "p11", "p12", "p13", "p14"], logoInitials: "DW",
  },
  {
    id: "t3", name: "ATL Falcons 7s", abbreviation: "ATL", color: "#D4A84B", secondaryColor: "#1C1917",
    region: "Southeast", elo: 1520, record: { wins: 11, losses: 5, ties: 0 }, roster: ["p15", "p16", "p17", "p18", "p19", "p20", "p21"], logoInitials: "AF",
  },
  {
    id: "t4", name: "Jersey Sharks", abbreviation: "JSK", color: "#2DD4A8", secondaryColor: "#042F2E",
    region: "Northeast", elo: 1490, record: { wins: 10, losses: 5, ties: 2 }, roster: ["p22", "p23", "p24", "p25", "p26", "p27", "p28"], logoInitials: "JS",
  },
  {
    id: "t5", name: "Carolina Storm", abbreviation: "CRS", color: "#A855F7", secondaryColor: "#1E1030",
    region: "Southeast", elo: 1475, record: { wins: 9, losses: 6, ties: 1 }, roster: ["p29", "p30", "p31", "p32", "p33", "p34", "p35"], logoInitials: "CS",
  },
  {
    id: "t6", name: "Philly United", abbreviation: "PHU", color: "#F59E0B", secondaryColor: "#1C1507",
    region: "Mid-Atlantic", elo: 1460, record: { wins: 9, losses: 7, ties: 0 }, roster: ["p36", "p37", "p38", "p39", "p40", "p41", "p42"], logoInitials: "PU",
  },
  {
    id: "t7", name: "Boston Elite", abbreviation: "BOS", color: "#EF4444", secondaryColor: "#1C0A0A",
    region: "Northeast", elo: 1440, record: { wins: 8, losses: 7, ties: 1 }, roster: ["p43", "p44", "p45", "p46", "p47", "p48", "p49"], logoInitials: "BE",
  },
  {
    id: "t8", name: "Florida Heat", abbreviation: "FLH", color: "#FB923C", secondaryColor: "#1C120A",
    region: "Southeast", elo: 1420, record: { wins: 7, losses: 8, ties: 1 }, roster: ["p50", "p51", "p52", "p53", "p54", "p55", "p56"], logoInitials: "FH",
  },
];

const positions = ["QB", "WR", "CB", "S", "LB", "RB", "DE"];
const firstNames = ["Marcus", "Jaylen", "Devon", "Trevon", "Khalil", "Darius", "Isaiah", "Malik", "Tyrese", "Andre", "Cameron", "Xavier", "Bryce", "Jalen", "Kai"];
const lastNames = ["Williams", "Johnson", "Davis", "Brown", "Wilson", "Moore", "Taylor", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Robinson", "Clark"];

function generatePlayers(): Player[] {
  const players: Player[] = [];
  let playerIndex = 0;
  for (const team of TEAMS) {
    for (let i = 0; i < 7; i++) {
      const fn = firstNames[(playerIndex + i) % firstNames.length];
      const ln = lastNames[(playerIndex + i + 3) % lastNames.length];
      players.push({
        id: `p${playerIndex * 7 + i + 1}`,
        name: `${fn} ${ln}`,
        position: positions[i % positions.length],
        number: 10 + i * 3 + playerIndex,
        teamId: team.id,
        stats: {
          touchdowns: Math.floor(Math.random() * 20) + 2,
          interceptions: Math.floor(Math.random() * 8),
          gamesPlayed: Math.floor(Math.random() * 15) + 5,
          wins: Math.floor(Math.random() * 10) + 2,
          mvpAwards: Math.floor(Math.random() * 3),
        },
        elo: 1200 + Math.floor(Math.random() * 400),
        region: team.region,
      });
    }
    playerIndex++;
  }
  return players;
}

export const PLAYERS: Player[] = generatePlayers();

const liveBracket: Bracket = {
  id: "br1",
  tournamentId: "tour1",
  rounds: [
    {
      roundNumber: 1,
      name: "Quarterfinals",
      matches: [
        { id: "m1", roundNumber: 1, matchNumber: 1, team1Id: "t1", team2Id: "t8", team1Score: 28, team2Score: 14, winnerId: "t1", status: "completed", scheduledTime: "9:00 AM", fieldId: "f1" },
        { id: "m2", roundNumber: 1, matchNumber: 2, team1Id: "t2", team2Id: "t7", team1Score: 21, team2Score: 17, winnerId: "t2", status: "completed", scheduledTime: "9:00 AM", fieldId: "f2" },
        { id: "m3", roundNumber: 1, matchNumber: 3, team1Id: "t3", team2Id: "t6", team1Score: 14, team2Score: 7, winnerId: "t3", status: "completed", scheduledTime: "10:30 AM", fieldId: "f1" },
        { id: "m4", roundNumber: 1, matchNumber: 4, team1Id: "t4", team2Id: "t5", team1Score: 21, team2Score: 24, winnerId: "t5", status: "completed", scheduledTime: "10:30 AM", fieldId: "f2" },
      ],
    },
    {
      roundNumber: 2,
      name: "Semifinals",
      matches: [
        { id: "m5", roundNumber: 2, matchNumber: 1, team1Id: "t1", team2Id: "t2", team1Score: 14, team2Score: 7, winnerId: undefined, status: "live", scheduledTime: "12:00 PM", fieldId: "f1" },
        { id: "m6", roundNumber: 2, matchNumber: 2, team1Id: "t3", team2Id: "t5", status: "pending", scheduledTime: "12:00 PM", fieldId: "f2" },
      ],
    },
    {
      roundNumber: 3,
      name: "Championship",
      matches: [
        { id: "m7", roundNumber: 3, matchNumber: 1, status: "pending", scheduledTime: "2:00 PM", fieldId: "f1" },
      ],
    },
  ],
};

export const TOURNAMENTS: Tournament[] = [
  {
    id: "tour1",
    name: "Meca East Coast Invitational",
    date: "2026-02-16",
    location: "MetLife Complex, NJ",
    region: "Northeast",
    status: "live",
    teamCount: 8,
    registeredTeams: TEAMS.map(t => t.id),
    bracket: liveBracket,
    fields: [
      { id: "f1", name: "Field A", currentMatch: "m5" },
      { id: "f2", name: "Field B" },
    ],
    description: "The flagship Meca invitational featuring the top 8 teams from the East Coast circuit.",
  },
  {
    id: "tour2",
    name: "DMV Classic",
    date: "2026-03-08",
    location: "FedEx Field Complex, MD",
    region: "Mid-Atlantic",
    status: "upcoming",
    teamCount: 8,
    registeredTeams: ["t2", "t4", "t6"],
    fields: [
      { id: "f3", name: "Field 1" },
      { id: "f4", name: "Field 2" },
    ],
    description: "Regional showcase bringing together the best from the DMV area.",
  },
  {
    id: "tour3",
    name: "Southeast Showdown",
    date: "2026-03-22",
    location: "Bank of America Complex, NC",
    region: "Southeast",
    status: "upcoming",
    teamCount: 8,
    registeredTeams: ["t3", "t5", "t8"],
    fields: [
      { id: "f5", name: "Main Field" },
      { id: "f6", name: "Practice Field" },
    ],
    description: "The premier Southeast 7v7 tournament in the Meca circuit.",
  },
  {
    id: "tour4",
    name: "Meca Winter Kickoff",
    date: "2026-01-18",
    endDate: "2026-01-19",
    location: "Giants Training Facility, NJ",
    region: "Northeast",
    status: "completed",
    teamCount: 8,
    registeredTeams: TEAMS.map(t => t.id),
    fields: [
      { id: "f7", name: "Turf A" },
      { id: "f8", name: "Turf B" },
    ],
    description: "Season opener kicking off the 2026 Meca circuit.",
  },
];

export const EVENTS: Event[] = [
  { id: "e1", type: "score", title: "LIVE: Titans vs Wolves", description: "East Side Titans lead DMV Wolves 14-7 in the semifinal", timestamp: "2026-02-16T12:15:00Z", tournamentId: "tour1", matchId: "m5" },
  { id: "e2", type: "result", title: "Quarterfinal Complete", description: "Carolina Storm upsets Jersey Sharks 24-21 to advance", timestamp: "2026-02-16T11:30:00Z", tournamentId: "tour1", matchId: "m4" },
  { id: "e3", type: "result", title: "ATL Falcons 7s Advance", description: "ATL defeats Philly United 14-7 in dominant defensive showing", timestamp: "2026-02-16T11:25:00Z", tournamentId: "tour1", matchId: "m3" },
  { id: "e4", type: "announcement", title: "DMV Classic Registration Open", description: "Sign up for the March 8th DMV Classic tournament. Limited to 8 teams.", timestamp: "2026-02-15T09:00:00Z", tournamentId: "tour2" },
  { id: "e5", type: "schedule", title: "Southeast Showdown Dates Set", description: "March 22nd at Bank of America Complex. Early bird pricing available.", timestamp: "2026-02-14T14:00:00Z", tournamentId: "tour3" },
];

export const TEAM_RANKINGS: LeaderboardEntry[] = TEAMS
  .sort((a, b) => b.elo - a.elo)
  .map((t, i) => ({
    rank: i + 1,
    teamId: t.id,
    name: t.name,
    elo: t.elo,
    change: [+15, +8, -3, +12, +22, -5, +3, -10][i],
    region: t.region,
  }));

export const PLAYER_RANKINGS: LeaderboardEntry[] = PLAYERS
  .sort((a, b) => b.elo - a.elo)
  .slice(0, 20)
  .map((p, i) => ({
    rank: i + 1,
    playerId: p.id,
    name: p.name,
    elo: p.elo,
    change: Math.floor(Math.random() * 30) - 10,
    region: p.region,
  }));

export function getTeamById(id: string): Team | undefined {
  return TEAMS.find(t => t.id === id);
}

export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find(p => p.id === id);
}

export function getPlayersByTeam(teamId: string): Player[] {
  return PLAYERS.filter(p => p.teamId === teamId);
}

export function getTournamentById(id: string): Tournament | undefined {
  return TOURNAMENTS.find(t => t.id === id);
}
