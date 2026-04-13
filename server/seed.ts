import { db } from "./db";
import {
  users, teams, players, tournaments, fields,
  games, tournamentTeams, activityEvents,
  gamePlayerStats, playerExternalLinks, playerRecruitingProfiles,
  playerHighlights, notifications, coachTeams,
} from "@shared/schema";
import { hashPassword } from "./auth";
import { sql, eq } from "drizzle-orm";

export async function seedDatabase() {
  console.log("Wiping existing data...");
  await db.execute(sql`TRUNCATE TABLE coach_teams, notifications, game_player_stats, player_external_links, player_recruiting_profiles, player_highlights, activity_events, games, fields, tournament_teams, orders, audit_logs, tournaments, players, teams, users RESTART IDENTITY CASCADE`);

  console.log("Seeding fresh database...");

  const adminPw = await hashPassword("admin123");
  const [admin] = await db.insert(users).values({
    username: "admin",
    password: adminPw,
    name: "Admin User",
    email: "admin@meca7v7.com",
    role: "admin",
    region: "",
  }).returning();

  const coachPw = await hashPassword("coach123");
  const [coach1] = await db.insert(users).values({
    username: "coach_ray",
    password: coachPw,
    name: "Ray Henderson",
    email: "ray@neeagles.com",
    role: "coach",
    region: "Northeast",
  }).returning();

  const specPw = await hashPassword("spec123");
  await db.insert(users).values({
    username: "fan_mike",
    password: specPw,
    name: "Mike Torres",
    email: "mike.torres@gmail.com",
    role: "spectator",
    region: "Mid-Atlantic",
  });

  const baseOrgs = [
    { name: "Northeast Eagles", abbreviation: "NE", color: "#1A3C8F", logoInitials: "NE", region: "Northeast" },
    { name: "Philly Thunder", abbreviation: "PHT", color: "#E8272C", logoInitials: "PHT", region: "Mid-Atlantic" },
    { name: "DMV Legends", abbreviation: "DMV", color: "#8B4513", logoInitials: "DMV", region: "DMV" },
    { name: "ATL Blaze", abbreviation: "ATL", color: "#FF4500", logoInitials: "ATL", region: "Southeast" },
    { name: "Playmakers Elite", abbreviation: "PME", color: "#4F6AF6", logoInitials: "PME", region: "Northeast" },
    { name: "FL Hurricanes", abbreviation: "FLH", color: "#006D75", logoInitials: "FLH", region: "Southeast" },
    { name: "Flight300", abbreviation: "F3", color: "#FF6B35", logoInitials: "F3", region: "Mid-Atlantic" },
    { name: "New Jersey Rated", abbreviation: "NJR", color: "#E74C3C", logoInitials: "NJR", region: "Northeast" },
    { name: "NYC Titans", abbreviation: "NYC", color: "#2C2C54", logoInitials: "NYC", region: "Northeast" },
    { name: "New Era Elite", abbreviation: "NEE", color: "#2ECC71", logoInitials: "NEE", region: "Mid-Atlantic" },
    { name: "Maryland Ghosts", abbreviation: "MDG", color: "#9B59B6", logoInitials: "MDG", region: "DMV" },
    { name: "Carolina Wolves", abbreviation: "CLW", color: "#4A4A4A", logoInitials: "CLW", region: "Southeast" },
    { name: "Why Not Me", abbreviation: "WNM", color: "#F39C12", logoInitials: "WNM", region: "Mid-Atlantic" },
    { name: "Jersey Knights", abbreviation: "JRK", color: "#1E3A5F", logoInitials: "JRK", region: "Northeast" },
    { name: "VA Royals", abbreviation: "VAR", color: "#7D3C98", logoInitials: "VAR", region: "Mid-Atlantic" },
    { name: "CT Cobras", abbreviation: "CTC", color: "#196F3D", logoInitials: "CTC", region: "Northeast" },
  ];

  const teamStats18U = [
    { elo: 1680, wins: 14, losses: 3, ties: 1 },
    { elo: 1645, wins: 13, losses: 4, ties: 1 },
    { elo: 1590, wins: 11, losses: 5, ties: 2 },
    { elo: 1560, wins: 10, losses: 6, ties: 2 },
    { elo: 1550, wins: 12, losses: 4, ties: 2 },
    { elo: 1520, wins: 9, losses: 7, ties: 2 },
    { elo: 1510, wins: 10, losses: 5, ties: 3 },
    { elo: 1505, wins: 11, losses: 5, ties: 2 },
    { elo: 1495, wins: 8, losses: 8, ties: 2 },
    { elo: 1490, wins: 9, losses: 6, ties: 3 },
    { elo: 1475, wins: 8, losses: 7, ties: 3 },
    { elo: 1470, wins: 7, losses: 9, ties: 2 },
    { elo: 1460, wins: 7, losses: 8, ties: 3 },
    { elo: 1440, wins: 6, losses: 10, ties: 2 },
    { elo: 1430, wins: 5, losses: 10, ties: 3 },
    { elo: 1415, wins: 4, losses: 11, ties: 3 },
  ];

  const teams18U = await db.insert(teams).values(
    baseOrgs.map((org, i) => ({
      name: `${org.name} 18U`,
      abbreviation: org.abbreviation,
      color: org.color,
      logoInitials: org.logoInitials,
      region: org.region,
      ageGroup: "18U",
      elo: teamStats18U[i].elo,
      wins: teamStats18U[i].wins,
      losses: teamStats18U[i].losses,
      ties: teamStats18U[i].ties,
      approved: true,
    }))
  ).returning();

  const orgs15UIdxs = [0, 1, 3, 5, 6, 8, 9, 12, 13, 14];
  const teamStats15U = [
    { elo: 1520, wins: 10, losses: 4, ties: 2 },
    { elo: 1510, wins: 9, losses: 5, ties: 2 },
    { elo: 1480, wins: 8, losses: 6, ties: 2 },
    { elo: 1460, wins: 7, losses: 7, ties: 2 },
    { elo: 1440, wins: 7, losses: 6, ties: 3 },
    { elo: 1430, wins: 6, losses: 8, ties: 2 },
    { elo: 1420, wins: 6, losses: 7, ties: 3 },
    { elo: 1400, wins: 5, losses: 9, ties: 2 },
    { elo: 1390, wins: 5, losses: 8, ties: 3 },
    { elo: 1380, wins: 4, losses: 10, ties: 2 },
  ];

  const teams15UArr = await db.insert(teams).values(
    orgs15UIdxs.map((orgIdx, i) => ({
      name: `${baseOrgs[orgIdx].name} 15U`,
      abbreviation: baseOrgs[orgIdx].abbreviation,
      color: baseOrgs[orgIdx].color,
      logoInitials: baseOrgs[orgIdx].logoInitials,
      region: baseOrgs[orgIdx].region,
      ageGroup: "15U",
      elo: teamStats15U[i].elo,
      wins: teamStats15U[i].wins,
      losses: teamStats15U[i].losses,
      ties: teamStats15U[i].ties,
      approved: true,
    }))
  ).returning();

  const team15UByOrg = new Map<number, typeof teams15UArr[0]>();
  orgs15UIdxs.forEach((orgIdx, i) => team15UByOrg.set(orgIdx, teams15UArr[i]));

  const orgs14UIdxs = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const teamStats14U = [
    { elo: 1470, wins: 9, losses: 5, ties: 2 },
    { elo: 1450, wins: 8, losses: 6, ties: 2 },
    { elo: 1430, wins: 7, losses: 7, ties: 2 },
    { elo: 1420, wins: 7, losses: 6, ties: 3 },
    { elo: 1410, wins: 6, losses: 7, ties: 3 },
    { elo: 1400, wins: 6, losses: 6, ties: 4 },
    { elo: 1390, wins: 5, losses: 8, ties: 3 },
    { elo: 1380, wins: 5, losses: 7, ties: 4 },
    { elo: 1370, wins: 5, losses: 8, ties: 3 },
    { elo: 1360, wins: 4, losses: 9, ties: 3 },
    { elo: 1350, wins: 4, losses: 9, ties: 3 },
    { elo: 1340, wins: 3, losses: 10, ties: 3 },
    { elo: 1330, wins: 3, losses: 10, ties: 3 },
  ];

  const teams14UArr = await db.insert(teams).values(
    orgs14UIdxs.map((orgIdx, i) => ({
      name: `${baseOrgs[orgIdx].name} 14U`,
      abbreviation: baseOrgs[orgIdx].abbreviation,
      color: baseOrgs[orgIdx].color,
      logoInitials: baseOrgs[orgIdx].logoInitials,
      region: baseOrgs[orgIdx].region,
      ageGroup: "14U",
      elo: teamStats14U[i].elo,
      wins: teamStats14U[i].wins,
      losses: teamStats14U[i].losses,
      ties: teamStats14U[i].ties,
      approved: true,
    }))
  ).returning();

  const team14UByOrg = new Map<number, typeof teams14UArr[0]>();
  orgs14UIdxs.forEach((orgIdx, i) => team14UByOrg.set(orgIdx, teams14UArr[i]));

  await db.insert(coachTeams).values({ userId: coach1.id, teamId: teams18U[0].id, approved: true });

  const playersList18U = [
    { name: "Marcus Thompson", position: "QB", number: 7, teamIdx: 0, elo: 1720, touchdowns: 24, interceptions: 3, gamesPlayed: 18, wins: 14, mvpAwards: 3, height: "6'2\"", weight: 195, classYear: "2027", bio: "Elite dual-threat QB with a cannon arm. Led Northeast Eagles to back-to-back championship appearances." },
    { name: "DeShawn Williams", position: "WR", number: 1, teamIdx: 0, elo: 1650, touchdowns: 18, interceptions: 0, gamesPlayed: 17, wins: 13, mvpAwards: 1, height: "5'11\"", weight: 175, classYear: "2027", bio: "Explosive route runner with top-end speed." },
    { name: "Jaylen Carter", position: "DB", number: 21, teamIdx: 0, elo: 1580, touchdowns: 2, interceptions: 8, gamesPlayed: 18, wins: 14, mvpAwards: 1, height: "6'0\"", weight: 180, classYear: "2028" },
    { name: "Darius Moore", position: "LB", number: 44, teamIdx: 0, elo: 1540, touchdowns: 1, interceptions: 3, gamesPlayed: 16, wins: 12, mvpAwards: 0, height: "6'1\"", weight: 210, classYear: "2027" },
    { name: "Keon Grant", position: "WR", number: 5, teamIdx: 0, elo: 1510, touchdowns: 9, interceptions: 0, gamesPlayed: 15, wins: 11, mvpAwards: 0, height: "5'10\"", weight: 165, classYear: "2028" },
    { name: "Amir Brooks", position: "RB", number: 22, teamIdx: 0, elo: 1490, touchdowns: 7, interceptions: 0, gamesPlayed: 14, wins: 10, mvpAwards: 0, height: "5'9\"", weight: 185, classYear: "2027" },
    { name: "Zion Reed", position: "OL", number: 72, teamIdx: 0, elo: 1460, touchdowns: 0, interceptions: 0, gamesPlayed: 18, wins: 14, mvpAwards: 0, height: "6'4\"", weight: 275, classYear: "2026" },

    { name: "Tyrese Jackson", position: "QB", number: 3, teamIdx: 1, elo: 1690, touchdowns: 22, interceptions: 5, gamesPlayed: 17, wins: 12, mvpAwards: 2, height: "6'3\"", weight: 200, classYear: "2027", bio: "Big-armed pocket passer with great field vision. Philly Thunder's franchise QB." },
    { name: "Andre Mitchell", position: "LB", number: 55, teamIdx: 1, elo: 1610, touchdowns: 3, interceptions: 4, gamesPlayed: 17, wins: 12, mvpAwards: 1, height: "6'2\"", weight: 215, classYear: "2026" },
    { name: "Jamal Pope", position: "WR", number: 11, teamIdx: 1, elo: 1570, touchdowns: 14, interceptions: 0, gamesPlayed: 16, wins: 11, mvpAwards: 0, height: "6'0\"", weight: 180, classYear: "2027" },
    { name: "Devon Banks", position: "DB", number: 2, teamIdx: 1, elo: 1530, touchdowns: 1, interceptions: 7, gamesPlayed: 17, wins: 12, mvpAwards: 1, height: "5'11\"", weight: 175, classYear: "2028" },
    { name: "Tre Walker", position: "RB", number: 28, teamIdx: 1, elo: 1500, touchdowns: 10, interceptions: 0, gamesPlayed: 15, wins: 10, mvpAwards: 0, height: "5'10\"", weight: 190, classYear: "2027" },
    { name: "Isaiah Dunn", position: "DL", number: 90, teamIdx: 1, elo: 1480, touchdowns: 0, interceptions: 1, gamesPlayed: 16, wins: 11, mvpAwards: 0, height: "6'3\"", weight: 250, classYear: "2026" },
    { name: "Cam Nichols", position: "WR", number: 14, teamIdx: 1, elo: 1455, touchdowns: 8, interceptions: 0, gamesPlayed: 14, wins: 9, mvpAwards: 0, height: "5'9\"", weight: 165, classYear: "2028" },

    { name: "Kevin Brown", position: "RB", number: 22, teamIdx: 2, elo: 1560, touchdowns: 15, interceptions: 0, gamesPlayed: 16, wins: 10, mvpAwards: 1, height: "5'11\"", weight: 195, classYear: "2027" },
    { name: "Malik Johnson", position: "WR", number: 11, teamIdx: 2, elo: 1530, touchdowns: 12, interceptions: 0, gamesPlayed: 16, wins: 10, mvpAwards: 0, height: "6'1\"", weight: 185, classYear: "2027" },
    { name: "Quincy Adams", position: "QB", number: 10, teamIdx: 2, elo: 1580, touchdowns: 19, interceptions: 6, gamesPlayed: 17, wins: 11, mvpAwards: 1, height: "6'0\"", weight: 188, classYear: "2026" },
    { name: "Elijah Forte", position: "DB", number: 6, teamIdx: 2, elo: 1510, touchdowns: 3, interceptions: 6, gamesPlayed: 16, wins: 10, mvpAwards: 0, height: "5'10\"", weight: 170, classYear: "2028" },
    { name: "Nate Wallace", position: "LB", number: 33, teamIdx: 2, elo: 1490, touchdowns: 1, interceptions: 2, gamesPlayed: 15, wins: 9, mvpAwards: 0, height: "6'2\"", weight: 220, classYear: "2027" },
    { name: "Rashad King", position: "OL", number: 75, teamIdx: 2, elo: 1450, touchdowns: 0, interceptions: 0, gamesPlayed: 17, wins: 11, mvpAwards: 0, height: "6'5\"", weight: 280, classYear: "2026" },
    { name: "Donte Hill", position: "WR", number: 85, teamIdx: 2, elo: 1440, touchdowns: 6, interceptions: 0, gamesPlayed: 13, wins: 8, mvpAwards: 0, height: "6'3\"", weight: 195, classYear: "2028" },

    { name: "Chris Davis", position: "QB", number: 9, teamIdx: 3, elo: 1545, touchdowns: 19, interceptions: 7, gamesPlayed: 16, wins: 9, mvpAwards: 1, height: "6'1\"", weight: 192, classYear: "2027" },
    { name: "Jordan Lee", position: "DB", number: 4, teamIdx: 3, elo: 1500, touchdowns: 1, interceptions: 10, gamesPlayed: 16, wins: 9, mvpAwards: 1, height: "6'0\"", weight: 178, classYear: "2027", bio: "Lockdown corner with elite ball skills. Led the league in interceptions." },
    { name: "Miles Foster", position: "WR", number: 8, teamIdx: 3, elo: 1520, touchdowns: 13, interceptions: 0, gamesPlayed: 15, wins: 8, mvpAwards: 0, height: "5'11\"", weight: 172, classYear: "2028" },
    { name: "Xavier James", position: "RB", number: 32, teamIdx: 3, elo: 1470, touchdowns: 8, interceptions: 0, gamesPlayed: 14, wins: 7, mvpAwards: 0, height: "5'9\"", weight: 185, classYear: "2027" },
    { name: "Troy Neal", position: "DL", number: 93, teamIdx: 3, elo: 1450, touchdowns: 0, interceptions: 0, gamesPlayed: 15, wins: 8, mvpAwards: 0, height: "6'4\"", weight: 255, classYear: "2026" },
    { name: "RJ Collins", position: "LB", number: 50, teamIdx: 3, elo: 1435, touchdowns: 1, interceptions: 3, gamesPlayed: 14, wins: 7, mvpAwards: 0, height: "6'1\"", weight: 205, classYear: "2027" },
    { name: "Bryson Cole", position: "WR", number: 17, teamIdx: 3, elo: 1410, touchdowns: 5, interceptions: 0, gamesPlayed: 12, wins: 6, mvpAwards: 0, height: "6'2\"", weight: 185, classYear: "2028" },

    { name: "Justin Barrow", position: "QB", number: 1, teamIdx: 4, elo: 1600, touchdowns: 16, interceptions: 2, gamesPlayed: 14, wins: 10, mvpAwards: 2, height: "5'11\"", weight: 180, classYear: "2027", bio: "Accurate passer who rarely turns the ball over. Heart and soul of Playmakers Elite." },
    { name: "Trey Mack", position: "WR", number: 13, teamIdx: 4, elo: 1520, touchdowns: 11, interceptions: 0, gamesPlayed: 13, wins: 9, mvpAwards: 0, height: "6'0\"", weight: 175, classYear: "2028" },
    { name: "Dante Young", position: "DB", number: 24, teamIdx: 4, elo: 1480, touchdowns: 2, interceptions: 5, gamesPlayed: 14, wins: 10, mvpAwards: 0, height: "5'10\"", weight: 168, classYear: "2027" },
    { name: "Omar Scott", position: "RB", number: 34, teamIdx: 4, elo: 1460, touchdowns: 9, interceptions: 0, gamesPlayed: 12, wins: 8, mvpAwards: 0, height: "5'8\"", weight: 178, classYear: "2028" },
    { name: "Caleb Perry", position: "LB", number: 48, teamIdx: 4, elo: 1440, touchdowns: 0, interceptions: 2, gamesPlayed: 14, wins: 10, mvpAwards: 0, height: "6'0\"", weight: 200, classYear: "2026" },
    { name: "Marco Rivera", position: "OL", number: 68, teamIdx: 4, elo: 1425, touchdowns: 0, interceptions: 0, gamesPlayed: 14, wins: 10, mvpAwards: 0, height: "6'3\"", weight: 260, classYear: "2027" },
    { name: "Jace Monroe", position: "WR", number: 19, teamIdx: 4, elo: 1410, touchdowns: 4, interceptions: 0, gamesPlayed: 11, wins: 7, mvpAwards: 0, height: "5'9\"", weight: 160, classYear: "2028" },

    { name: "Tyler Robinson", position: "WR", number: 88, teamIdx: 5, elo: 1485, touchdowns: 10, interceptions: 0, gamesPlayed: 15, wins: 8, mvpAwards: 0, height: "6'1\"", weight: 182, classYear: "2027" },
    { name: "Damien Cruz", position: "QB", number: 5, teamIdx: 5, elo: 1510, touchdowns: 15, interceptions: 4, gamesPlayed: 15, wins: 9, mvpAwards: 1, height: "6'0\"", weight: 185, classYear: "2027" },
    { name: "Sean Powell", position: "DB", number: 20, teamIdx: 5, elo: 1460, touchdowns: 2, interceptions: 5, gamesPlayed: 14, wins: 7, mvpAwards: 0, height: "5'11\"", weight: 175, classYear: "2028" },
    { name: "Logan Hayes", position: "RB", number: 30, teamIdx: 5, elo: 1445, touchdowns: 7, interceptions: 0, gamesPlayed: 13, wins: 7, mvpAwards: 0, height: "5'10\"", weight: 188, classYear: "2027" },
    { name: "Kyle Bennett", position: "LB", number: 42, teamIdx: 5, elo: 1430, touchdowns: 0, interceptions: 2, gamesPlayed: 14, wins: 7, mvpAwards: 0, height: "6'2\"", weight: 210, classYear: "2026" },
    { name: "Noah Chen", position: "WR", number: 16, teamIdx: 5, elo: 1400, touchdowns: 5, interceptions: 0, gamesPlayed: 12, wins: 6, mvpAwards: 0, height: "5'8\"", weight: 155, classYear: "2028" },
    { name: "Liam Ortega", position: "OL", number: 77, teamIdx: 5, elo: 1390, touchdowns: 0, interceptions: 0, gamesPlayed: 15, wins: 9, mvpAwards: 0, height: "6'5\"", weight: 270, classYear: "2026" },

    { name: "Jamal Harris", position: "QB", number: 12, teamIdx: 6, elo: 1500, touchdowns: 14, interceptions: 6, gamesPlayed: 16, wins: 10, mvpAwards: 0, height: "6'0\"", weight: 185, classYear: "2027" },
    { name: "Corey Sims", position: "WR", number: 80, teamIdx: 6, elo: 1475, touchdowns: 11, interceptions: 0, gamesPlayed: 15, wins: 9, mvpAwards: 0, height: "6'2\"", weight: 190, classYear: "2027" },
    { name: "Terrance Floyd", position: "DB", number: 26, teamIdx: 6, elo: 1450, touchdowns: 1, interceptions: 4, gamesPlayed: 14, wins: 8, mvpAwards: 0, height: "5'10\"", weight: 170, classYear: "2028" },
    { name: "Derrick Holmes", position: "RB", number: 35, teamIdx: 6, elo: 1420, touchdowns: 6, interceptions: 0, gamesPlayed: 13, wins: 7, mvpAwards: 0, height: "5'11\"", weight: 192, classYear: "2027" },

    { name: "Ryan Owens", position: "LB", number: 52, teamIdx: 7, elo: 1485, touchdowns: 2, interceptions: 5, gamesPlayed: 16, wins: 11, mvpAwards: 0, height: "6'1\"", weight: 208, classYear: "2026" },
    { name: "Jared Cole", position: "QB", number: 15, teamIdx: 7, elo: 1495, touchdowns: 17, interceptions: 5, gamesPlayed: 16, wins: 11, mvpAwards: 1, height: "6'2\"", weight: 195, classYear: "2027" },
    { name: "Marcus Reed", position: "WR", number: 9, teamIdx: 7, elo: 1460, touchdowns: 10, interceptions: 0, gamesPlayed: 15, wins: 10, mvpAwards: 0, height: "5'11\"", weight: 170, classYear: "2028" },
    { name: "Kendall Wright", position: "DB", number: 31, teamIdx: 7, elo: 1440, touchdowns: 1, interceptions: 6, gamesPlayed: 16, wins: 11, mvpAwards: 0, height: "6'0\"", weight: 178, classYear: "2027" },

    { name: "Isaac Torres", position: "QB", number: 8, teamIdx: 8, elo: 1480, touchdowns: 13, interceptions: 5, gamesPlayed: 14, wins: 8, mvpAwards: 0, height: "5'11\"", weight: 182, classYear: "2027" },
    { name: "Malik Stevens", position: "WR", number: 6, teamIdx: 8, elo: 1460, touchdowns: 9, interceptions: 0, gamesPlayed: 14, wins: 8, mvpAwards: 0, height: "6'1\"", weight: 178, classYear: "2028" },
    { name: "Zack Palmer", position: "DB", number: 23, teamIdx: 8, elo: 1430, touchdowns: 0, interceptions: 4, gamesPlayed: 13, wins: 7, mvpAwards: 0, height: "5'10\"", weight: 172, classYear: "2027" },

    { name: "Dante Reyes", position: "QB", number: 4, teamIdx: 9, elo: 1470, touchdowns: 14, interceptions: 5, gamesPlayed: 15, wins: 9, mvpAwards: 0, height: "6'0\"", weight: 190, classYear: "2027" },
    { name: "Tomas Green", position: "WR", number: 18, teamIdx: 9, elo: 1445, touchdowns: 8, interceptions: 0, gamesPlayed: 14, wins: 8, mvpAwards: 0, height: "5'10\"", weight: 168, classYear: "2028" },
    { name: "Ian Buckley", position: "DB", number: 29, teamIdx: 9, elo: 1420, touchdowns: 1, interceptions: 5, gamesPlayed: 14, wins: 8, mvpAwards: 0, height: "6'0\"", weight: 175, classYear: "2027" },

    { name: "David Clark", position: "RB", number: 25, teamIdx: 10, elo: 1455, touchdowns: 11, interceptions: 0, gamesPlayed: 14, wins: 8, mvpAwards: 0, height: "5'9\"", weight: 180, classYear: "2027" },
    { name: "Jayon Scott", position: "QB", number: 2, teamIdx: 10, elo: 1465, touchdowns: 12, interceptions: 6, gamesPlayed: 15, wins: 8, mvpAwards: 0, height: "6'1\"", weight: 188, classYear: "2027" },

    { name: "Brandon Lewis", position: "DB", number: 31, teamIdx: 11, elo: 1440, touchdowns: 1, interceptions: 6, gamesPlayed: 14, wins: 7, mvpAwards: 0, height: "5'11\"", weight: 175, classYear: "2027" },
    { name: "Kareem West", position: "QB", number: 11, teamIdx: 11, elo: 1445, touchdowns: 10, interceptions: 7, gamesPlayed: 14, wins: 7, mvpAwards: 0, height: "6'0\"", weight: 185, classYear: "2028" },
  ];

  const insertedPlayers18U = await db.insert(players).values(
    playersList18U.map((p) => ({
      name: p.name,
      position: p.position,
      number: p.number,
      teamId: teams18U[p.teamIdx].id,
      region: teams18U[p.teamIdx].region || "",
      elo: p.elo,
      touchdowns: p.touchdowns,
      interceptions: p.interceptions,
      gamesPlayed: p.gamesPlayed,
      wins: p.wins,
      mvpAwards: p.mvpAwards,
    }))
  ).returning();

  const firstNames15U = [
    "Jayden", "Aiden", "Ethan", "Mason", "Logan", "Lucas", "Noah",
    "Liam", "Jackson", "Caleb", "Carter", "Dylan", "Luke", "Grayson",
    "Landon", "Hunter", "Connor", "Ryan", "Nolan", "Cooper",
    "Brayden", "Camden", "Jaxon", "Easton", "Chase", "Carson",
    "Asher", "Micah", "Colton", "Braxton", "Declan", "Sawyer",
    "Owen", "Gavin", "Blake", "Jace", "Austin", "Adrian", "Eli",
    "Axel", "Cash", "Brooks", "Felix", "Grant", "Griffin", "Hayes",
    "Kai", "Knox", "Lane", "Luca",
  ];
  const firstNames14U = [
    "Nash", "Paxton", "Reed", "Ryder", "Tate", "Tucker", "Wade",
    "Weston", "Zane", "Beckett", "Bodhi", "Cruz", "Emerson", "Finn",
    "Hendrix", "Hugo", "Jett", "Lennox", "Maddox", "Miles",
    "Phoenix", "Remington", "Rowan", "Silas", "Sterling", "Sullivan",
    "Theo", "Tobias", "Wilder", "Wyatt", "Atlas", "Bear", "Crew",
    "Dash", "Ezra", "Ford", "Grey", "Harley", "Ivan", "Jasper",
    "Kade", "Leo", "Maverick", "Nico", "Oliver", "Pierce", "Quinn",
    "Roman", "Sage", "Tristan", "Urban", "Vance", "Walker", "Xander",
    "Yuri", "Zeke", "Archer", "Banks", "Chance", "Drake", "Ellis",
    "Flynn", "Heath", "Ira",
  ];
  const lastNames = [
    "Anderson", "Bailey", "Barnes", "Bell", "Bennett", "Brooks",
    "Butler", "Campbell", "Carter", "Clark", "Coleman", "Cooper",
    "Cruz", "Davis", "Dixon", "Edwards", "Evans", "Fisher",
    "Foster", "Garcia", "Gibson", "Gray", "Green", "Griffin",
    "Hall", "Harper", "Harris", "Hayes", "Henderson", "Hill",
    "Howard", "Hughes", "Hunt", "Jackson", "James", "Jenkins",
    "Jones", "Jordan", "Kelly", "Kennedy", "King", "Knight",
    "Lee", "Lewis", "Long", "Martin", "Mason", "Miller",
    "Mitchell", "Moore", "Morgan", "Morris", "Nelson", "Parker",
    "Patterson", "Perry", "Phillips", "Porter", "Powell", "Price",
    "Reed", "Ross", "Russell", "Santos", "Shaw", "Silva",
  ];
  const positions7v7 = ["QB", "WR", "WR", "RB", "DB"];

  let nameIdx15U = 0;
  const players15UData: { name: string; position: string; number: number; teamId: string; region: string; elo: number; touchdowns: number; interceptions: number; gamesPlayed: number; wins: number; }[] = [];
  for (const team of teams15UArr) {
    for (let j = 0; j < 5; j++) {
      const fn = firstNames15U[nameIdx15U % firstNames15U.length];
      const ln = lastNames[nameIdx15U % lastNames.length];
      const pos = positions7v7[j];
      const elo = 1200 + Math.floor(Math.random() * 250);
      players15UData.push({
        name: `${fn} ${ln}`,
        position: pos,
        number: [1, 7, 11, 22, 4][j],
        teamId: team.id,
        region: team.region || "",
        elo,
        touchdowns: pos === "QB" ? 8 + Math.floor(Math.random() * 10) : (pos === "WR" ? 4 + Math.floor(Math.random() * 8) : (pos === "RB" ? 3 + Math.floor(Math.random() * 6) : Math.floor(Math.random() * 2))),
        interceptions: pos === "DB" ? 2 + Math.floor(Math.random() * 5) : (pos === "QB" ? Math.floor(Math.random() * 4) : 0),
        gamesPlayed: 10 + Math.floor(Math.random() * 6),
        wins: Math.floor(Math.random() * 10),
      });
      nameIdx15U++;
    }
  }
  if (players15UData.length > 0) {
    await db.insert(players).values(players15UData);
  }

  let nameIdx14U = 0;
  const players14UData: typeof players15UData = [];
  for (const team of teams14UArr) {
    for (let j = 0; j < 5; j++) {
      const fn = firstNames14U[nameIdx14U % firstNames14U.length];
      const ln = lastNames[(nameIdx14U + 30) % lastNames.length];
      const pos = positions7v7[j];
      const elo = 1150 + Math.floor(Math.random() * 200);
      players14UData.push({
        name: `${fn} ${ln}`,
        position: pos,
        number: [3, 8, 15, 25, 6][j],
        teamId: team.id,
        region: team.region || "",
        elo,
        touchdowns: pos === "QB" ? 5 + Math.floor(Math.random() * 8) : (pos === "WR" ? 3 + Math.floor(Math.random() * 6) : (pos === "RB" ? 2 + Math.floor(Math.random() * 5) : Math.floor(Math.random() * 2))),
        interceptions: pos === "DB" ? 1 + Math.floor(Math.random() * 4) : (pos === "QB" ? Math.floor(Math.random() * 3) : 0),
        gamesPlayed: 8 + Math.floor(Math.random() * 6),
        wins: Math.floor(Math.random() * 8),
      });
      nameIdx14U++;
    }
  }
  if (players14UData.length > 0) {
    await db.insert(players).values(players14UData);
  }

  const marcusThompson = insertedPlayers18U[0];
  const deshawnWilliams = insertedPlayers18U[1];
  const jaylenCarter = insertedPlayers18U[2];
  const keonGrant = insertedPlayers18U[4];
  const tyreseJackson = insertedPlayers18U[7];
  const andreMitchell = insertedPlayers18U[8];
  const jamalPope = insertedPlayers18U[9];
  const devonBanks = insertedPlayers18U[10];
  const kevinBrown = insertedPlayers18U[14];
  const quincyAdams = insertedPlayers18U[16];
  const elijahForte = insertedPlayers18U[17];
  const chrisDavis = insertedPlayers18U[21];
  const jordanLee = insertedPlayers18U[22];
  const milesFoster = insertedPlayers18U[23];
  const justinBarrow = insertedPlayers18U[28];
  const treyMack = insertedPlayers18U[29];
  const danteYoung = insertedPlayers18U[30];
  const tylerRobinson = insertedPlayers18U[35];
  const damienCruz = insertedPlayers18U[36];
  const jamalHarris = insertedPlayers18U[42];
  const coreySims = insertedPlayers18U[43];
  const jaredCole = insertedPlayers18U[47];
  const marcusReed = insertedPlayers18U[48];
  const isaacTorres = insertedPlayers18U[50];
  const danteReyes = insertedPlayers18U[53];

  await db.insert(playerExternalLinks).values([
    { playerId: marcusThompson.id, platform: "twitter", url: "https://twitter.com/marcusqb7", ogTitle: "Marcus Thompson (@marcusqb7)", ogDescription: "Highlights, camp invites, and 7v7 life.", ogImage: null },
    { playerId: marcusThompson.id, platform: "hudl", url: "https://www.hudl.com/profile/12345678", ogTitle: "Marcus Thompson - Hudl", ogDescription: "Game film and highlights for Marcus Thompson – NE Eagles QB", ogImage: null },
    { playerId: marcusThompson.id, platform: "instagram", url: "https://instagram.com/marcus7v7", ogTitle: "Marcus Thompson (@marcus7v7)", ogDescription: "NE Eagles QB | Class of 2027", ogImage: null },
    { playerId: deshawnWilliams.id, platform: "twitter", url: "https://twitter.com/dshawn_wr1", ogTitle: "DeShawn Williams (@dshawn_wr1)", ogDescription: "NE Eagles WR1 | Route God | Class of 2027", ogImage: null },
    { playerId: deshawnWilliams.id, platform: "hudl", url: "https://www.hudl.com/profile/23456789", ogTitle: "DeShawn Williams - Hudl", ogDescription: "Top-rated WR prospect with game-changing speed", ogImage: null },
    { playerId: jaylenCarter.id, platform: "instagram", url: "https://instagram.com/jcarter_db21", ogTitle: "Jaylen Carter (@jcarter_db21)", ogDescription: "NE Eagles DB | Ball Hawk | 8 INTs", ogImage: null },
    { playerId: keonGrant.id, platform: "twitter", url: "https://twitter.com/keon_g5", ogTitle: "Keon Grant (@keon_g5)", ogDescription: "NE Eagles WR | Speedster | Class of 2028", ogImage: null },
    { playerId: tyreseJackson.id, platform: "twitter", url: "https://twitter.com/t_jack3", ogTitle: "Tyrese Jackson (@t_jack3)", ogDescription: "PHT QB | D1 Bound", ogImage: null },
    { playerId: tyreseJackson.id, platform: "hudl", url: "https://www.hudl.com/profile/87654321", ogTitle: "Tyrese Jackson - Hudl", ogDescription: "Philly Thunder QB game film and recruiting highlights", ogImage: null },
    { playerId: tyreseJackson.id, platform: "instagram", url: "https://instagram.com/tyrese_qb3", ogTitle: "Tyrese Jackson (@tyrese_qb3)", ogDescription: "Philly Thunder | QB3 | Class of 2027", ogImage: null },
    { playerId: andreMitchell.id, platform: "hudl", url: "https://www.hudl.com/profile/34567890", ogTitle: "Andre Mitchell - Hudl", ogDescription: "Philly Thunder LB – hardest hitter in 7v7", ogImage: null },
    { playerId: jamalPope.id, platform: "twitter", url: "https://twitter.com/jpope_wr11", ogTitle: "Jamal Pope (@jpope_wr11)", ogDescription: "PHT WR | Red Zone Threat | 14 TDs", ogImage: null },
    { playerId: jamalPope.id, platform: "instagram", url: "https://instagram.com/jamal_pope11", ogTitle: "Jamal Pope (@jamal_pope11)", ogDescription: "Philly Thunder #11 | WR | Class of 2027", ogImage: null },
    { playerId: devonBanks.id, platform: "hudl", url: "https://www.hudl.com/profile/45678901", ogTitle: "Devon Banks - Hudl", ogDescription: "PHT DB – 7 INTs on the season. Lockdown coverage.", ogImage: null },
    { playerId: kevinBrown.id, platform: "twitter", url: "https://twitter.com/kbrown_rb22", ogTitle: "Kevin Brown (@kbrown_rb22)", ogDescription: "DMV Legends RB | Yards King | D1 offers", ogImage: null },
    { playerId: kevinBrown.id, platform: "hudl", url: "https://www.hudl.com/profile/56789012", ogTitle: "Kevin Brown - Hudl", ogDescription: "DMV Legends RB highlights – 15 TDs, power runner", ogImage: null },
    { playerId: quincyAdams.id, platform: "twitter", url: "https://twitter.com/quincy_qb10", ogTitle: "Quincy Adams (@quincy_qb10)", ogDescription: "DMV Legends QB | Field General | 19 TDs", ogImage: null },
    { playerId: quincyAdams.id, platform: "instagram", url: "https://instagram.com/quincyadams10", ogTitle: "Quincy Adams (@quincyadams10)", ogDescription: "DMV Legends | QB | Senior Season", ogImage: null },
    { playerId: elijahForte.id, platform: "hudl", url: "https://www.hudl.com/profile/67890123", ogTitle: "Elijah Forte - Hudl", ogDescription: "DMV Legends DB – 6 INTs, elite coverage skills", ogImage: null },
    { playerId: chrisDavis.id, platform: "twitter", url: "https://twitter.com/cdavis_qb9", ogTitle: "Chris Davis (@cdavis_qb9)", ogDescription: "ATL Blaze QB | Dual-threat | Class of 2027", ogImage: null },
    { playerId: chrisDavis.id, platform: "hudl", url: "https://www.hudl.com/profile/78901234", ogTitle: "Chris Davis - Hudl", ogDescription: "ATL Blaze QB game film – 19 TDs, dynamic playmaker", ogImage: null },
    { playerId: jordanLee.id, platform: "instagram", url: "https://instagram.com/jlee_lockdown", ogTitle: "Jordan Lee (@jlee_lockdown)", ogDescription: "ATL Blaze DB | Ball Hawk | 10 INTs", ogImage: null },
    { playerId: jordanLee.id, platform: "hudl", url: "https://www.hudl.com/profile/89012345", ogTitle: "Jordan Lee - Hudl", ogDescription: "ATL Blaze shutdown corner – league INT leader", ogImage: null },
    { playerId: milesFoster.id, platform: "twitter", url: "https://twitter.com/miles_f8", ogTitle: "Miles Foster (@miles_f8)", ogDescription: "ATL Blaze WR | Deep Threat | Class of 2028", ogImage: null },
    { playerId: justinBarrow.id, platform: "hudl", url: "https://www.hudl.com/profile/99887766", ogTitle: "Justin Barrow - Hudl", ogDescription: "Playmakers Elite QB highlights and game film", ogImage: null },
    { playerId: justinBarrow.id, platform: "twitter", url: "https://twitter.com/jbarrow_qb1", ogTitle: "Justin Barrow (@jbarrow_qb1)", ogDescription: "Playmakers Elite QB | 2x MVP | Class of 2027", ogImage: null },
    { playerId: justinBarrow.id, platform: "instagram", url: "https://instagram.com/justin.barrow1", ogTitle: "Justin Barrow (@justin.barrow1)", ogDescription: "PME QB1 | Bergen Catholic | 3.9 GPA", ogImage: null },
    { playerId: treyMack.id, platform: "hudl", url: "https://www.hudl.com/profile/11223344", ogTitle: "Trey Mack - Hudl", ogDescription: "PME WR – big play machine, 11 TDs", ogImage: null },
    { playerId: treyMack.id, platform: "instagram", url: "https://instagram.com/treymack13", ogTitle: "Trey Mack (@treymack13)", ogDescription: "Playmakers Elite #13 | WR | Class of 2028", ogImage: null },
    { playerId: danteYoung.id, platform: "twitter", url: "https://twitter.com/dyoung_db24", ogTitle: "Dante Young (@dyoung_db24)", ogDescription: "PME DB | 5 INTs | Lockdown", ogImage: null },
    { playerId: tylerRobinson.id, platform: "hudl", url: "https://www.hudl.com/profile/22334455", ogTitle: "Tyler Robinson - Hudl", ogDescription: "FL Hurricanes WR – 10 TDs, reliable hands", ogImage: null },
    { playerId: damienCruz.id, platform: "twitter", url: "https://twitter.com/dcruz_qb5", ogTitle: "Damien Cruz (@dcruz_qb5)", ogDescription: "FL Hurricanes QB | Accurate | Class of 2027", ogImage: null },
    { playerId: damienCruz.id, platform: "hudl", url: "https://www.hudl.com/profile/33445566", ogTitle: "Damien Cruz - Hudl", ogDescription: "FL Hurricanes QB – 15 TDs, smart decision maker", ogImage: null },
    { playerId: jamalHarris.id, platform: "twitter", url: "https://twitter.com/jharris_qb12", ogTitle: "Jamal Harris (@jharris_qb12)", ogDescription: "Flight300 QB | Gunslinger | 14 TDs", ogImage: null },
    { playerId: jamalHarris.id, platform: "hudl", url: "https://www.hudl.com/profile/44556677", ogTitle: "Jamal Harris - Hudl", ogDescription: "Flight300 QB game film and highlights", ogImage: null },
    { playerId: coreySims.id, platform: "instagram", url: "https://instagram.com/csims80", ogTitle: "Corey Sims (@csims80)", ogDescription: "Flight300 WR | 6'2 Target | Class of 2027", ogImage: null },
    { playerId: jaredCole.id, platform: "twitter", url: "https://twitter.com/jcole_qb15", ogTitle: "Jared Cole (@jcole_qb15)", ogDescription: "NJR QB | MVP | Rising Star", ogImage: null },
    { playerId: jaredCole.id, platform: "hudl", url: "https://www.hudl.com/profile/55667788", ogTitle: "Jared Cole - Hudl", ogDescription: "New Jersey Rated QB – 17 TDs, competitive edge", ogImage: null },
    { playerId: marcusReed.id, platform: "instagram", url: "https://instagram.com/mreed_wr9", ogTitle: "Marcus Reed (@mreed_wr9)", ogDescription: "NJR WR | Class of 2028 | Speed Kills", ogImage: null },
    { playerId: isaacTorres.id, platform: "twitter", url: "https://twitter.com/itorres_qb8", ogTitle: "Isaac Torres (@itorres_qb8)", ogDescription: "NYC Titans QB | City Kid | Class of 2027", ogImage: null },
    { playerId: isaacTorres.id, platform: "hudl", url: "https://www.hudl.com/profile/66778899", ogTitle: "Isaac Torres - Hudl", ogDescription: "NYC Titans QB – 13 TDs, tough competitor", ogImage: null },
    { playerId: danteReyes.id, platform: "twitter", url: "https://twitter.com/dreyes_qb4", ogTitle: "Dante Reyes (@dreyes_qb4)", ogDescription: "New Era Elite QB | Playmaker | 14 TDs", ogImage: null },
  ]);

  await db.insert(playerRecruitingProfiles).values([
    { playerId: marcusThompson.id, fortyYard: "4.55", shuttle: "4.10", vertical: "34\"", gpa: "3.7", satScore: "1220", highlights: "2x All-Tournament, Led team to 2 championship games. Holds school records for passing yards.", school: "Bergen Catholic HS", state: "NJ", coachName: "Coach Martinez", coachEmail: "martinez@bergencatholic.org", coachPhone: "(201) 555-0147" },
    { playerId: deshawnWilliams.id, fortyYard: "4.42", shuttle: "3.95", vertical: "38\"", gpa: "3.5", satScore: "1180", highlights: "Fastest player in the circuit. 3 offers from D1 programs.", school: "Don Bosco Prep", state: "NJ", coachName: "Coach Williams", coachEmail: "williams@donbosco.org", coachPhone: "(201) 555-0234" },
    { playerId: jaylenCarter.id, fortyYard: "4.48", shuttle: "4.05", vertical: "36\"", gpa: "3.8", satScore: "1250", highlights: "8 INTs on the season. Named All-Tournament DB twice. Physical at the line of scrimmage.", school: "St. Peter's Prep", state: "NJ", coachName: "Coach O'Brien", coachEmail: "obrien@stpeters.org", coachPhone: "(201) 555-0312" },
    { playerId: tyreseJackson.id, fortyYard: "4.60", shuttle: "4.15", vertical: "33\"", gpa: "3.4", satScore: "1150", highlights: "Big arm, pocket presence. Led Philly Thunder to multiple tournament wins.", school: "Imhotep Charter", state: "PA", coachName: "Coach Jackson", coachEmail: "jackson@imhotep.org", coachPhone: "(215) 555-0189" },
    { playerId: andreMitchell.id, fortyYard: "4.52", shuttle: "4.08", vertical: "35\"", gpa: "3.6", satScore: "1190", highlights: "Hardest hitter in the circuit. Sideline-to-sideline range.", school: "Roman Catholic HS", state: "PA", coachName: "Coach Davis", coachEmail: "davis@romancatholic.org", coachPhone: "(215) 555-0267" },
    { playerId: jamalPope.id, fortyYard: "4.45", shuttle: "3.98", vertical: "37\"", gpa: "3.3", satScore: "1100", highlights: "14 TDs on the season. Red zone machine with contested catch ability.", school: "Northeast HS", state: "PA", coachName: "Coach Brown", coachEmail: "brown@northeast.org", coachPhone: "(215) 555-0345" },
    { playerId: kevinBrown.id, fortyYard: "4.50", shuttle: "4.12", vertical: "35\"", gpa: "3.5", satScore: "1170", highlights: "Power back with breakaway speed. 15 TDs, over 1000 rushing yards.", school: "DeMatha Catholic", state: "MD", coachName: "Coach Henderson", coachEmail: "henderson@dematha.org", coachPhone: "(301) 555-0423" },
    { playerId: quincyAdams.id, fortyYard: "4.58", shuttle: "4.10", vertical: "32\"", gpa: "3.9", satScore: "1280", highlights: "19 TDs, field general. High football IQ with accuracy.", school: "Gonzaga College HS", state: "DC", coachName: "Coach Adams", coachEmail: "adams@gonzaga.org", coachPhone: "(202) 555-0501" },
    { playerId: chrisDavis.id, fortyYard: "4.52", shuttle: "4.05", vertical: "34\"", gpa: "3.4", satScore: "1140", highlights: "Dual-threat QB. 19 TDs, dynamic playmaker with elusiveness.", school: "Pace Academy", state: "GA", coachName: "Coach Foster", coachEmail: "foster@paceacademy.org", coachPhone: "(404) 555-0156" },
    { playerId: jordanLee.id, fortyYard: "4.44", shuttle: "3.92", vertical: "38\"", gpa: "3.7", satScore: "1230", highlights: "League INT leader with 10 picks. Shutdown corner.", school: "Woodward Academy", state: "GA", coachName: "Coach Lee", coachEmail: "lee@woodward.org", coachPhone: "(404) 555-0234" },
    { playerId: justinBarrow.id, fortyYard: "4.58", shuttle: "4.12", vertical: "33\"", gpa: "3.9", satScore: "1290", highlights: "2x MVP, rarely turns it over. 16 TDs, 2 INTs on the field. 3.9 GPA, 4.52 forty.", school: "Bergen Catholic HS", state: "NJ", coachName: "Coach Martinez", coachEmail: "martinez@bergencatholic.org", coachPhone: "(201) 555-0147" },
    { playerId: treyMack.id, fortyYard: "4.40", shuttle: "3.90", vertical: "39\"", gpa: "3.6", satScore: "1200", highlights: "Big play machine. 11 TDs, explosive after the catch. 3.6 GPA, 4.40 forty.", school: "Paramus Catholic", state: "NJ", coachName: "Coach Mack", coachEmail: "mack@paramuscatholic.org", coachPhone: "(201) 555-0178" },
    { playerId: danteYoung.id, fortyYard: "4.46", shuttle: "3.98", vertical: "36\"", gpa: "3.5", satScore: "1160", highlights: "Ball hawk DB with 5 INTs. Physical in press coverage. 3.5 GPA, 4.46 forty.", school: "Don Bosco Prep", state: "NJ", coachName: "Coach Young", coachEmail: "young@donbosco.org", coachPhone: "(201) 555-0289" },
    { playerId: damienCruz.id, fortyYard: "4.55", shuttle: "4.08", vertical: "34\"", gpa: "3.6", satScore: "1200", highlights: "Smart decision maker. 15 TDs, reads defenses well. 3.6 GPA, 4.55 forty.", school: "Flanagan HS", state: "FL", coachName: "Coach Cruz", coachEmail: "cruz@flanagan.org", coachPhone: "(954) 555-0123" },
    { playerId: jaredCole.id, fortyYard: "4.52", shuttle: "4.05", vertical: "35\"", gpa: "3.7", satScore: "1240", highlights: "MVP caliber QB. 17 TDs, competitive edge. 3.7 GPA, 4.52 forty.", school: "St. Joseph Regional", state: "NJ", coachName: "Coach Cole", coachEmail: "cole@sjr.org", coachPhone: "(201) 555-0356" },
    { playerId: milesFoster.id, fortyYard: "4.38", shuttle: "3.88", vertical: "40\"", gpa: "3.4", satScore: "1130", highlights: "Deep threat WR. 13 TDs, burner speed. 3.4 GPA, 4.38 forty.", school: "Grayson HS", state: "GA", coachName: "Coach Foster Sr.", coachEmail: "foster@grayson.org", coachPhone: "(678) 555-0189" },
    { playerId: devonBanks.id, fortyYard: "4.42", shuttle: "3.95", vertical: "37\"", gpa: "3.8", satScore: "1260", highlights: "7 INTs, lockdown coverage. Reads routes. 3.8 GPA, 4.42 forty.", school: "La Salle College HS", state: "PA", coachName: "Coach Banks", coachEmail: "banks@lasalle.org", coachPhone: "(215) 555-0267" },
    { playerId: tylerRobinson.id, fortyYard: "4.45", shuttle: "4.00", vertical: "36\"", gpa: "3.3", satScore: "1100", highlights: "Reliable hands WR. 10 TDs, clutch catches. 3.3 GPA, 4.45 forty.", school: "American Heritage", state: "FL", coachName: "Coach Robinson", coachEmail: "robinson@ahschool.org", coachPhone: "(954) 555-0234" },
    { playerId: keonGrant.id, fortyYard: "4.35", shuttle: "3.85", vertical: "38\"", gpa: "3.6", satScore: "1180", highlights: "Speedster WR. 9 TDs, electrifying in the open field. 3.6 GPA, 4.35 forty.", school: "Seton Hall Prep", state: "NJ", coachName: "Coach Grant", coachEmail: "grant@shp.org", coachPhone: "(973) 555-0145" },
    { playerId: elijahForte.id, fortyYard: "4.48", shuttle: "4.02", vertical: "35\"", gpa: "3.5", satScore: "1150", highlights: "Ballhawk DB. 6 INTs, physical tackler. 3.5 GPA, 4.48 forty.", school: "Good Counsel", state: "MD", coachName: "Coach Forte", coachEmail: "forte@goodcounsel.org", coachPhone: "(301) 555-0312" },
    { playerId: isaacTorres.id, fortyYard: "4.58", shuttle: "4.10", vertical: "33\"", gpa: "3.4", satScore: "1120", highlights: "City tough QB. 13 TDs, competitor. 3.4 GPA, 4.58 forty.", school: "Erasmus Hall", state: "NY", coachName: "Coach Torres", coachEmail: "torres@erasmus.org", coachPhone: "(718) 555-0189" },
  ]);

  await db.insert(playerHighlights).values([
    { playerId: marcusThompson.id, title: "Spring Opener 18U QF1 Highlights", description: "3 TD passes and 285 yards in the quarterfinal win vs NJ Rated", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/marcusthompson-qf1", views: 1240, featured: true },
    { playerId: marcusThompson.id, title: "Kickoff Classic Championship TD", description: "Game-winning 45-yard TD pass to DeShawn Williams in the championship", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/marcusthompson-champ", views: 2850, featured: true },
    { playerId: marcusThompson.id, title: "Camp Highlight Reel 2025", description: "Top plays from the summer camp circuit — deep balls, scrambles, and QB runs", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/marcusthompson-camp2025", views: 890, featured: false },
    { playerId: deshawnWilliams.id, title: "Top 10 Catches – 2025 Season", description: "DeShawn's best contested catches, one-handers, and toe-tappers from the 2025 7v7 season", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/deshawnwilliams-top10", views: 1580, featured: true },
    { playerId: deshawnWilliams.id, title: "Route Running Breakdown", description: "Film study breakdown of DeShawn's elite route running — stems, releases, and separation", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/deshawnwilliams-routes", views: 720, featured: false },
    { playerId: jaylenCarter.id, title: "8 INT Season Montage", description: "Every interception from Jaylen Carter's dominant 2025 season", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jaylencarter-ints", views: 1100, featured: true },
    { playerId: jaylenCarter.id, title: "1v1 Coverage Reel", description: "Jaylen locking down the best receivers in 7v7. Press coverage highlights.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jaylencarter-1v1", views: 650, featured: false },
    { playerId: tyreseJackson.id, title: "Kickoff Classic MVP Performance", description: "Tyrese's MVP game — 4 TDs, 310 passing yards, and a game-winning drive", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/tyresejackson-mvp", views: 2100, featured: true },
    { playerId: tyreseJackson.id, title: "Deep Ball Compilation", description: "Every 40+ yard completion from Tyrese Jackson's 2025 season", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/tyresejackson-deepballs", views: 1350, featured: true },
    { playerId: tyreseJackson.id, title: "Pre-Season Training Camp", description: "Behind the scenes at Philly Thunder's pre-season camp — drills, 7on7, and film sessions", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/tyresejackson-camp", views: 480, featured: false },
    { playerId: kevinBrown.id, title: "1000 Yard Season Highlights", description: "Kevin Brown's best runs from a 1000+ yard, 15 TD season with DMV Legends", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/kevinbrown-1000yds", views: 1680, featured: true },
    { playerId: kevinBrown.id, title: "Power vs Speed – Film Breakdown", description: "How Kevin Brown combines power and speed to dominate 7v7 defenses", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/kevinbrown-film", views: 920, featured: false },
    { playerId: quincyAdams.id, title: "19 TD Season Recap", description: "Every touchdown pass from Quincy Adams' incredible 2025 campaign", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/quincyadams-19tds", views: 1420, featured: true },
    { playerId: jordanLee.id, title: "10 INT Season – Lock Island", description: "Jordan Lee's historic 10-interception season. Best DB in 7v7.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jordanlee-10ints", views: 1890, featured: true },
    { playerId: jordanLee.id, title: "Combine Performance", description: "4.44 forty, 38\" vertical — Jordan Lee's elite testing numbers on display", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jordanlee-combine", views: 760, featured: false },
    { playerId: chrisDavis.id, title: "ATL Blaze Playoff Run", description: "Chris Davis leads ATL Blaze through the bracket — 8 TDs in 3 games", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/chrisdavis-playoffs", views: 1250, featured: true },
    { playerId: justinBarrow.id, title: "2x MVP Highlight Reel", description: "Justin Barrow's best plays from back-to-back MVP performances", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/justinbarrow-mvp", views: 1750, featured: true },
    { playerId: justinBarrow.id, title: "Zero Turnover Streak", description: "12 consecutive games without an interception — Justin's ball security on display", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/justinbarrow-zeroturn", views: 680, featured: false },
    { playerId: justinBarrow.id, title: "Bergen Catholic Spring Game", description: "Justin Barrow's high school spring game highlights — 3 TDs, 250+ yards", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/justinbarrow-spring", views: 950, featured: false },
    { playerId: treyMack.id, title: "Big Play Machine", description: "Trey Mack's 11 TDs — every score from a breakout 2025 season", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/treymack-bigplays", views: 1100, featured: true },
    { playerId: damienCruz.id, title: "FL Hurricanes Season Recap", description: "Damien Cruz's command of the offense — 15 TDs, smart reads, and clutch drives", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/damiencruz-recap", views: 980, featured: true },
    { playerId: jaredCole.id, title: "NJ Rated MVP Season", description: "Jared Cole's MVP campaign — 17 TDs and a relentless competitive fire", thumbnailUrl: null, videoUrl: "https://www.hudl.com/profile/jaredcole-mvp", views: 1320, featured: true },
    { playerId: milesFoster.id, title: "Deep Threat Compilation", description: "Miles Foster burning DBs deep — every 40+ yard catch from 2025", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/milesfoster-deep", views: 870, featured: true },
    { playerId: devonBanks.id, title: "7 INT Ball Hawk Season", description: "Devon Banks' best interceptions and pass breakups from 2025", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/devonbanks-ints", views: 1050, featured: true },
    { playerId: andreMitchell.id, title: "Hardest Hits Compilation", description: "Andre Mitchell's most physical plays — the enforcer of Philly Thunder's defense", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/andremitchell-hits", views: 1430, featured: true },
    { playerId: danteReyes.id, title: "New Era Elite Season Highlights", description: "Dante Reyes leading New Era Elite — 14 TDs and clutch 4th quarter drives", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/dantereyes-season", views: 780, featured: true },
    { playerId: jamalHarris.id, title: "Flight300 Gunslinger Reel", description: "Jamal Harris throwing darts — 14 TDs and highlight-reel throws for Flight300", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jamalharris-gunslinger", views: 860, featured: true },
  ]);

  const playerPw = await hashPassword("player123");
  const [marcusUser] = await db.insert(users).values({
    username: "marcus_t",
    password: playerPw,
    name: "Marcus Thompson",
    email: "marcus.thompson@bergen.edu",
    role: "player",
    region: "Northeast",
    playerId: marcusThompson.id,
    teamId: teams18U[0].id,
    playerLinkApproved: true,
  }).returning();

  const now = new Date();

  const [completedTournament] = await db.insert(tournaments).values({
    name: "The Meca Kickoff Classic - 18U",
    description: "Season opener at The Proving Grounds. 8 elite 18U teams kicked off the 2026 Meca season in an all-day battle.",
    location: "The Proving Grounds, Hammonton NJ",
    region: "Northeast",
    startDate: new Date("2026-02-08"),
    endDate: new Date("2026-02-08"),
    status: "completed",
    teamCount: 8,
    ageGroup: "18U",
    entryFee: 350,
    prizePool: 3000,
    createdBy: admin.id,
  }).returning();

  const [completedKickoff15U] = await db.insert(tournaments).values({
    name: "The Meca Kickoff Classic - 15U",
    description: "Season opener at The Proving Grounds. Top 15U squads battled in the cold to start the 2026 circuit.",
    location: "The Proving Grounds, Hammonton NJ",
    region: "Northeast",
    startDate: new Date("2026-02-08"),
    endDate: new Date("2026-02-08"),
    status: "completed",
    teamCount: 8,
    ageGroup: "15U",
    entryFee: 300,
    prizePool: 2500,
    createdBy: admin.id,
  }).returning();

  const [liveSpring18U] = await db.insert(tournaments).values({
    name: "The Meca Spring Opener - 18U",
    description: "The 18U division takes center stage. Eight top-ranked teams compete for early-season supremacy at MetLife.",
    location: "MetLife Stadium Complex, East Rutherford NJ",
    region: "Northeast",
    startDate: new Date(now.getTime() - 14400000),
    endDate: new Date(now.getTime() + 28800000),
    status: "live",
    teamCount: 8,
    ageGroup: "18U",
    entryFee: 500,
    prizePool: 5000,
    createdBy: admin.id,
  }).returning();

  const [liveSpring15U] = await db.insert(tournaments).values({
    name: "The Meca Spring Opener - 15U",
    description: "15U division of the Spring Opener. Six hungry squads competing on the big stage at MetLife.",
    location: "MetLife Stadium Complex, East Rutherford NJ",
    region: "Northeast",
    startDate: new Date(now.getTime() - 14400000),
    endDate: new Date(now.getTime() + 28800000),
    status: "live",
    teamCount: 6,
    ageGroup: "15U",
    entryFee: 400,
    prizePool: 3500,
    createdBy: admin.id,
  }).returning();

  const [liveSpring14U] = await db.insert(tournaments).values({
    name: "The Meca Spring Opener - 14U",
    description: "14U division of the Spring Opener. The next generation shows out at MetLife.",
    location: "MetLife Stadium Complex, East Rutherford NJ",
    region: "Northeast",
    startDate: new Date(now.getTime() - 14400000),
    endDate: new Date(now.getTime() + 28800000),
    status: "live",
    teamCount: 6,
    ageGroup: "14U",
    entryFee: 350,
    prizePool: 3000,
    createdBy: admin.id,
  }).returning();

  const [meca757_14U] = await db.insert(tournaments).values({
    name: "The Meca 757 - 14U",
    description: "Meca 7v7 hits Virginia Beach. Top 14U teams compete for bragging rights and championship glory.",
    location: "Virginia Beach Sportsplex, Virginia Beach VA",
    region: "Mid-Atlantic",
    startDate: new Date("2026-04-11"),
    endDate: new Date("2026-04-12"),
    status: "upcoming",
    teamCount: 8,
    ageGroup: "14U",
    entryFee: 400,
    prizePool: 4000,
    createdBy: admin.id,
  }).returning();

  const [meca757_15U] = await db.insert(tournaments).values({
    name: "The Meca 757 - 15U",
    description: "Meca 7v7 hits Virginia Beach. 15U teams battle on the biggest stage in the 757.",
    location: "Virginia Beach Sportsplex, Virginia Beach VA",
    region: "Mid-Atlantic",
    startDate: new Date("2026-04-11"),
    endDate: new Date("2026-04-12"),
    status: "upcoming",
    teamCount: 8,
    ageGroup: "15U",
    entryFee: 400,
    prizePool: 4000,
    createdBy: admin.id,
  }).returning();

  const [meca757_18U] = await db.insert(tournaments).values({
    name: "The Meca 757 - 18U",
    description: "Meca 7v7 hits Virginia Beach. Elite 18U competition under the lights at Virginia Beach Sportsplex.",
    location: "Virginia Beach Sportsplex, Virginia Beach VA",
    region: "Mid-Atlantic",
    startDate: new Date("2026-04-11"),
    endDate: new Date("2026-04-12"),
    status: "upcoming",
    teamCount: 8,
    ageGroup: "18U",
    entryFee: 450,
    prizePool: 5000,
    createdBy: admin.id,
  }).returning();

  const [mecaDE_14U] = await db.insert(tournaments).values({
    name: "The Meca DE - 14U",
    description: "Meca 7v7 arrives in Delaware. 14U division on championship turf at DE Turf.",
    location: "DE Turf Sports Complex, Frederica DE",
    region: "Mid-Atlantic",
    startDate: new Date("2026-05-16"),
    endDate: new Date("2026-05-17"),
    status: "upcoming",
    teamCount: 8,
    ageGroup: "14U",
    entryFee: 400,
    prizePool: 4000,
    createdBy: admin.id,
  }).returning();

  const [mecaDE_15U] = await db.insert(tournaments).values({
    name: "The Meca DE - 15U",
    description: "Meca 7v7 arrives in Delaware. 15U teams go head-to-head on championship turf.",
    location: "DE Turf Sports Complex, Frederica DE",
    region: "Mid-Atlantic",
    startDate: new Date("2026-05-16"),
    endDate: new Date("2026-05-17"),
    status: "upcoming",
    teamCount: 8,
    ageGroup: "15U",
    entryFee: 400,
    prizePool: 4000,
    createdBy: admin.id,
  }).returning();

  const [mecaDE_18U] = await db.insert(tournaments).values({
    name: "The Meca DE - 18U",
    description: "Meca 7v7 arrives in Delaware. The 18U showcase at DE Turf Sports Complex.",
    location: "DE Turf Sports Complex, Frederica DE",
    region: "Mid-Atlantic",
    startDate: new Date("2026-05-16"),
    endDate: new Date("2026-05-17"),
    status: "upcoming",
    teamCount: 8,
    ageGroup: "18U",
    entryFee: 450,
    prizePool: 5000,
    createdBy: admin.id,
  }).returning();

  const [mecaSummer_14U] = await db.insert(tournaments).values({
    name: "The Meca Summer Championship - 14U",
    description: "The crown jewel of the Meca circuit. 14U teams battle for the summer title at Bader Field.",
    location: "Bader Field, Atlantic City NJ",
    region: "Northeast",
    startDate: new Date("2026-07-18"),
    endDate: new Date("2026-07-19"),
    status: "upcoming",
    teamCount: 16,
    ageGroup: "14U",
    entryFee: 550,
    prizePool: 8000,
    createdBy: admin.id,
  }).returning();

  const [mecaSummer_15U] = await db.insert(tournaments).values({
    name: "The Meca Summer Championship - 15U",
    description: "The crown jewel of the Meca circuit. 15U division — biggest prize pool of the season.",
    location: "Bader Field, Atlantic City NJ",
    region: "Northeast",
    startDate: new Date("2026-07-18"),
    endDate: new Date("2026-07-19"),
    status: "upcoming",
    teamCount: 16,
    ageGroup: "15U",
    entryFee: 550,
    prizePool: 8000,
    createdBy: admin.id,
  }).returning();

  const [mecaSummer_18U] = await db.insert(tournaments).values({
    name: "The Meca Summer Championship - 18U",
    description: "The crown jewel of the Meca circuit. 18U grand finale — who takes the crown?",
    location: "Bader Field, Atlantic City NJ",
    region: "Northeast",
    startDate: new Date("2026-07-18"),
    endDate: new Date("2026-07-19"),
    status: "upcoming",
    teamCount: 16,
    ageGroup: "18U",
    entryFee: 600,
    prizePool: 10000,
    createdBy: admin.id,
  }).returning();

  for (const t of [completedTournament, completedKickoff15U, liveSpring18U, liveSpring15U, liveSpring14U]) {
    await db.insert(fields).values([
      { tournamentId: t.id, name: "Field 1" },
      { tournamentId: t.id, name: "Field 2" },
      { tournamentId: t.id, name: "Field 3" },
      { tournamentId: t.id, name: "Field 4" },
    ]);
  }
  for (const t of [meca757_14U, meca757_15U, meca757_18U, mecaDE_14U, mecaDE_15U, mecaDE_18U, mecaSummer_14U, mecaSummer_15U, mecaSummer_18U]) {
    await db.insert(fields).values([
      { tournamentId: t.id, name: "Field A" },
      { tournamentId: t.id, name: "Field B" },
      { tournamentId: t.id, name: "Field C" },
    ]);
  }

  const live18UOrgIdxs = [0, 1, 2, 3, 4, 5, 6, 7];
  for (const idx of live18UOrgIdxs) {
    await db.insert(tournamentTeams).values({
      tournamentId: liveSpring18U.id,
      teamId: teams18U[idx].id,
    });
  }

  const live15UOrgIdxs = [0, 1, 3, 5, 9, 12];
  for (const orgIdx of live15UOrgIdxs) {
    await db.insert(tournamentTeams).values({
      tournamentId: liveSpring15U.id,
      teamId: team15UByOrg.get(orgIdx)!.id,
    });
  }

  const live14UOrgIdxs = [0, 4, 6, 8, 11, 13];
  for (const orgIdx of live14UOrgIdxs) {
    await db.insert(tournamentTeams).values({
      tournamentId: liveSpring14U.id,
      teamId: team14UByOrg.get(orgIdx)!.id,
    });
  }

  const completed18UOrgIdxs = [0, 1, 2, 3, 8, 9, 10, 11];
  for (const idx of completed18UOrgIdxs) {
    await db.insert(tournamentTeams).values({
      tournamentId: completedTournament.id,
      teamId: teams18U[idx].id,
    });
  }

  const completed15UOrgIdxs = [0, 1, 3, 5, 6, 9, 13, 14];
  for (const orgIdx of completed15UOrgIdxs) {
    await db.insert(tournamentTeams).values({
      tournamentId: completedKickoff15U.id,
      teamId: team15UByOrg.get(orgIdx)!.id,
    });
  }

  for (const orgIdx of [0, 4, 6, 7, 9, 10]) {
    await db.insert(tournamentTeams).values({
      tournamentId: meca757_14U.id,
      teamId: team14UByOrg.get(orgIdx)!.id,
    });
  }

  for (const orgIdx of [1, 3, 5, 8, 11, 12]) {
    await db.insert(tournamentTeams).values({
      tournamentId: mecaDE_14U.id,
      teamId: team14UByOrg.get(orgIdx)!.id,
    });
  }

  const lt = liveSpring18U;
  const liveTeams = live18UOrgIdxs.map((i) => teams18U[i]);

  const qfGames = [
    { mn: 1, aIdx: 0, bIdx: 7, sA: 28, sB: 14, winner: 0, status: "final" as const },
    { mn: 2, aIdx: 1, bIdx: 6, sA: 21, sB: 14, winner: 1, status: "final" as const },
    { mn: 3, aIdx: 2, bIdx: 5, sA: 24, sB: 21, winner: 2, status: "final" as const },
    { mn: 4, aIdx: 3, bIdx: 4, sA: 17, sB: 14, winner: 3, status: "final" as const },
  ];

  const sfGames = [
    { mn: 1, aIdx: 0, bIdx: 3, sA: 14, sB: 7, status: "live" as const },
    { mn: 2, aIdx: 1, bIdx: 2, sA: 0, sB: 0, status: "live" as const },
  ];

  const champGame = [
    { mn: 1, status: "scheduled" as const },
  ];

  const insertedQfGames = [];
  for (const g of qfGames) {
    const [inserted] = await db.insert(games).values({
      tournamentId: lt.id,
      roundNumber: 1,
      matchNumber: g.mn,
      roundName: "Quarterfinals",
      teamAId: liveTeams[g.aIdx].id,
      teamBId: liveTeams[g.bIdx].id,
      scoreA: g.sA,
      scoreB: g.sB,
      winnerId: liveTeams[g.winner].id,
      status: g.status,
      scheduledTime: new Date(now.getTime() - 7200000),
    }).returning();
    insertedQfGames.push(inserted);
  }

  for (const g of sfGames) {
    await db.insert(games).values({
      tournamentId: lt.id,
      roundNumber: 2,
      matchNumber: g.mn,
      roundName: "Semifinals",
      teamAId: liveTeams[g.aIdx].id,
      teamBId: liveTeams[g.bIdx].id,
      scoreA: g.sA,
      scoreB: g.sB,
      status: g.status,
      scheduledTime: new Date(now.getTime() - 1800000),
    });
  }

  for (const g of champGame) {
    await db.insert(games).values({
      tournamentId: lt.id,
      roundNumber: 3,
      matchNumber: g.mn,
      roundName: "Championship",
      status: g.status,
      scheduledTime: new Date(now.getTime() + 7200000),
    });
  }

  const live15UTeams = live15UOrgIdxs.map((i) => team15UByOrg.get(i)!);
  const pp15U = [
    { mn: 1, aIdx: 0, bIdx: 5, sA: 21, sB: 14, winner: 0 as number | null, status: "final" as const },
    { mn: 2, aIdx: 1, bIdx: 4, sA: 14, sB: 14, winner: null as number | null, status: "final" as const },
    { mn: 3, aIdx: 2, bIdx: 3, sA: 7, sB: 0, winner: null as number | null, status: "live" as const },
  ];
  for (const g of pp15U) {
    await db.insert(games).values({
      tournamentId: liveSpring15U.id,
      roundNumber: 0,
      matchNumber: g.mn,
      roundName: "Pool Play",
      teamAId: live15UTeams[g.aIdx].id,
      teamBId: live15UTeams[g.bIdx].id,
      scoreA: g.sA,
      scoreB: g.sB,
      winnerId: g.winner !== null ? live15UTeams[g.winner].id : null,
      status: g.status,
      scheduledTime: new Date(now.getTime() - 3600000 + g.mn * 1800000),
    });
  }

  const ct = completedTournament;
  const cTeams = completed18UOrgIdxs.map((i) => teams18U[i]);

  const cQf = [
    { mn: 1, aIdx: 0, bIdx: 7, sA: 35, sB: 14, winner: 0 },
    { mn: 2, aIdx: 1, bIdx: 6, sA: 28, sB: 21, winner: 1 },
    { mn: 3, aIdx: 2, bIdx: 5, sA: 21, sB: 7, winner: 2 },
    { mn: 4, aIdx: 3, bIdx: 4, sA: 24, sB: 17, winner: 3 },
  ];
  const cSf = [
    { mn: 1, aIdx: 0, bIdx: 3, sA: 28, sB: 21, winner: 0 },
    { mn: 2, aIdx: 1, bIdx: 2, sA: 35, sB: 28, winner: 1 },
  ];
  const cFinal = [
    { mn: 1, aIdx: 0, bIdx: 1, sA: 31, sB: 28, winner: 0 },
  ];

  for (const g of cQf) {
    await db.insert(games).values({
      tournamentId: ct.id, roundNumber: 1, matchNumber: g.mn, roundName: "Quarterfinals",
      teamAId: cTeams[g.aIdx].id, teamBId: cTeams[g.bIdx].id, scoreA: g.sA, scoreB: g.sB,
      winnerId: cTeams[g.winner].id, status: "final",
      scheduledTime: new Date("2026-02-08T09:00:00"),
    });
  }
  for (const g of cSf) {
    await db.insert(games).values({
      tournamentId: ct.id, roundNumber: 2, matchNumber: g.mn, roundName: "Semifinals",
      teamAId: cTeams[g.aIdx].id, teamBId: cTeams[g.bIdx].id, scoreA: g.sA, scoreB: g.sB,
      winnerId: cTeams[g.winner].id, status: "final",
      scheduledTime: new Date("2026-02-08T13:00:00"),
    });
  }
  for (const g of cFinal) {
    await db.insert(games).values({
      tournamentId: ct.id, roundNumber: 3, matchNumber: g.mn, roundName: "Championship",
      teamAId: cTeams[g.aIdx].id, teamBId: cTeams[g.bIdx].id, scoreA: g.sA, scoreB: g.sB,
      winnerId: cTeams[g.winner].id, status: "final",
      scheduledTime: new Date("2026-02-08T16:00:00"),
    });
  }

  const c15UTeams = completed15UOrgIdxs.map((i) => team15UByOrg.get(i)!);
  const c15Qf = [
    { mn: 1, aIdx: 0, bIdx: 7, sA: 21, sB: 7, winner: 0 },
    { mn: 2, aIdx: 1, bIdx: 6, sA: 28, sB: 14, winner: 1 },
    { mn: 3, aIdx: 2, bIdx: 5, sA: 14, sB: 7, winner: 2 },
    { mn: 4, aIdx: 3, bIdx: 4, sA: 21, sB: 14, winner: 3 },
  ];
  const c15Sf = [
    { mn: 1, aIdx: 0, bIdx: 3, sA: 14, sB: 7, winner: 0 },
    { mn: 2, aIdx: 1, bIdx: 2, sA: 21, sB: 14, winner: 1 },
  ];
  const c15Final = [
    { mn: 1, aIdx: 0, bIdx: 1, sA: 28, sB: 21, winner: 0 },
  ];
  for (const g of c15Qf) {
    await db.insert(games).values({
      tournamentId: completedKickoff15U.id, roundNumber: 1, matchNumber: g.mn, roundName: "Quarterfinals",
      teamAId: c15UTeams[g.aIdx].id, teamBId: c15UTeams[g.bIdx].id, scoreA: g.sA, scoreB: g.sB,
      winnerId: c15UTeams[g.winner].id, status: "final",
      scheduledTime: new Date("2026-02-08T09:30:00"),
    });
  }
  for (const g of c15Sf) {
    await db.insert(games).values({
      tournamentId: completedKickoff15U.id, roundNumber: 2, matchNumber: g.mn, roundName: "Semifinals",
      teamAId: c15UTeams[g.aIdx].id, teamBId: c15UTeams[g.bIdx].id, scoreA: g.sA, scoreB: g.sB,
      winnerId: c15UTeams[g.winner].id, status: "final",
      scheduledTime: new Date("2026-02-08T13:30:00"),
    });
  }
  for (const g of c15Final) {
    await db.insert(games).values({
      tournamentId: completedKickoff15U.id, roundNumber: 3, matchNumber: g.mn, roundName: "Championship",
      teamAId: c15UTeams[g.aIdx].id, teamBId: c15UTeams[g.bIdx].id, scoreA: g.sA, scoreB: g.sB,
      winnerId: c15UTeams[g.winner].id, status: "final",
      scheduledTime: new Date("2026-02-08T16:30:00"),
    });
  }

  const qf1PlayersTeamA = insertedPlayers18U.filter((p) => p.teamId === liveTeams[0].id).slice(0, 5);
  const qf1PlayersTeamB = insertedPlayers18U.filter((p) => p.teamId === liveTeams[7].id).slice(0, 4);

  for (const p of qf1PlayersTeamA) {
    const isQB = p.position === "QB";
    await db.insert(gamePlayerStats).values({
      gameId: insertedQfGames[0].id,
      playerId: p.id,
      teamId: liveTeams[0].id,
      touchdowns: isQB ? 3 : (p.position === "WR" ? 2 : 0),
      interceptions: isQB ? 0 : (p.position === "DB" ? 1 : 0),
      passingYards: isQB ? 285 : 0,
      rushingYards: p.position === "RB" ? 78 : 0,
      receivingYards: p.position === "WR" ? 120 : 0,
    });
  }
  for (const p of qf1PlayersTeamB) {
    const isQB = p.position === "QB";
    await db.insert(gamePlayerStats).values({
      gameId: insertedQfGames[0].id,
      playerId: p.id,
      teamId: liveTeams[7].id,
      touchdowns: isQB ? 1 : (p.position === "WR" ? 1 : 0),
      interceptions: isQB ? 1 : 0,
      passingYards: isQB ? 160 : 0,
      rushingYards: p.position === "RB" ? 45 : 0,
      receivingYards: p.position === "WR" ? 80 : 0,
    });
  }

  await db.insert(activityEvents).values([
    { type: "announcement", title: "Meca Spring Opener is LIVE!", description: "14U, 15U, and 18U divisions all competing today at MetLife Stadium Complex. Follow along for live scores!", tournamentId: liveSpring18U.id },
    { type: "score", title: "NE Eagles 28, NJR 14 — 18U QF1", description: "Northeast Eagles advance behind 3 TD passes from Marcus Thompson.", tournamentId: liveSpring18U.id },
    { type: "score", title: "PHT 21, F3 14 — 18U QF2", description: "Philly Thunder pulls away in the second half. Tyrese Jackson with 2 TDs.", tournamentId: liveSpring18U.id },
    { type: "score", title: "DMV 24, FLH 21 — 18U QF3", description: "DMV Legends survive a late rally from FL Hurricanes.", tournamentId: liveSpring18U.id },
    { type: "score", title: "ATL 17, PME 14 — 18U QF4", description: "ATL Blaze edges Playmakers Elite on a last-minute defensive stop.", tournamentId: liveSpring18U.id },
    { type: "result", title: "18U Quarterfinals Complete", description: "NE Eagles, Philly Thunder, DMV Legends, and ATL Blaze advance to the semifinals.", tournamentId: liveSpring18U.id },
    { type: "schedule", title: "18U Semifinals Now Underway", description: "NE Eagles vs ATL Blaze and Philly Thunder vs DMV Legends — live now!", tournamentId: liveSpring18U.id },
    { type: "score", title: "PHT 21, WNM 14 — 15U Pool Play", description: "Philly Thunder takes the first pool play game in the 15U bracket.", tournamentId: liveSpring15U.id },
    { type: "announcement", title: "The Meca 757 — April 11-12", description: "Registration is open for The Meca 757. Virginia Beach Sportsplex. 14U, 15U, and 18U divisions. Secure your spot!", tournamentId: meca757_14U.id },
    { type: "announcement", title: "The Meca DE — May 16-17", description: "The Meca DE at DE Turf Sports Complex, Frederica. All age groups. Registration opening soon.", tournamentId: mecaDE_14U.id },
    { type: "announcement", title: "Summer Championship Announced", description: "The Meca Summer Championship coming July 18-19 at Bader Field, Atlantic City. Biggest prize pool of the season!", tournamentId: mecaSummer_18U.id },
    { type: "result", title: "Kickoff Classic 18U Champion: NE Eagles", description: "Northeast Eagles won the Kickoff Classic 18U with a 31-28 victory over Philly Thunder.", tournamentId: ct.id },
    { type: "result", title: "Kickoff Classic 15U Champion: NE Eagles", description: "Northeast Eagles claimed the 15U Kickoff Classic title with a dominant 28-21 win.", tournamentId: completedKickoff15U.id },
  ]);

  await db.insert(notifications).values([
    { userId: marcusUser.id, type: "system", title: "Welcome to Meca!", message: "Your account is set up and linked to your player profile. Check out your stats and recruiting profile.", read: true },
    { userId: marcusUser.id, type: "tournament", title: "Spring Opener 18U is LIVE", message: "Your team NE Eagles 18U is competing now at MetLife. Good luck!", read: false },
    { userId: marcusUser.id, type: "system", title: "Profile Verified", message: "Your player profile link has been approved by an admin.", read: true },
  ]);

  // === ADDITIONAL USER ACCOUNTS ===
  const fanPw = await hashPassword("fan123");
  const coachPw2 = await hashPassword("coach456");
  const playerPw2 = await hashPassword("player456");

  const [fanJess] = await db.insert(users).values({ username: "fan_jess", password: fanPw, name: "Jessica Morgan", email: "jess.morgan@gmail.com", role: "spectator", region: "Northeast" }).returning();
  const [fanDre] = await db.insert(users).values({ username: "fan_dre", password: fanPw, name: "Andre Lewis", email: "andre.lewis@gmail.com", role: "spectator", region: "Mid-Atlantic" }).returning();
  const [fanCorey] = await db.insert(users).values({ username: "fan_corey", password: fanPw, name: "Corey Banks", email: "corey.banks@gmail.com", role: "spectator", region: "Southeast" }).returning();
  const [fanTasha] = await db.insert(users).values({ username: "fan_tasha", password: fanPw, name: "Natasha Rivera", email: "tasha.rivera@gmail.com", role: "spectator", region: "Northeast" }).returning();
  const [fanBrian] = await db.insert(users).values({ username: "fan_brian", password: fanPw, name: "Brian Wallace", email: "brian.w@gmail.com", role: "spectator", region: "DMV" }).returning();
  const [fanSophia] = await db.insert(users).values({ username: "fan_sophia", password: fanPw, name: "Sophia Chen", email: "sophia.chen@outlook.com", role: "spectator", region: "Northeast" }).returning();
  const [fanMarcus2] = await db.insert(users).values({ username: "fan_darius", password: fanPw, name: "Darius Franklin", email: "darius.franklin@gmail.com", role: "spectator", region: "Southeast" }).returning();
  const [fanKevin2] = await db.insert(users).values({ username: "fan_kev2", password: fanPw, name: "Kevin Grant", email: "kevin.grant77@gmail.com", role: "spectator", region: "Mid-Atlantic" }).returning();
  const [fanLisa] = await db.insert(users).values({ username: "fan_lisa", password: fanPw, name: "Lisa Thompson", email: "lisa.t@gmail.com", role: "spectator", region: "Northeast" }).returning();
  const [fanDevin] = await db.insert(users).values({ username: "fan_devin", password: fanPw, name: "Devin Okafor", email: "devin.okafor@gmail.com", role: "spectator", region: "DMV" }).returning();
  const [fanRachel] = await db.insert(users).values({ username: "fan_rachel", password: fanPw, name: "Rachel Simmons", email: "rachel.simmons@gmail.com", role: "spectator", region: "Southeast" }).returning();
  const [fanTyler] = await db.insert(users).values({ username: "fan_tyler2", password: fanPw, name: "Tyler Brooks", email: "tyler.brooks99@gmail.com", role: "spectator", region: "Northeast" }).returning();
  const [coachRon] = await db.insert(users).values({ username: "coach_ron", password: coachPw2, name: "Ronald Davis", email: "coach.ron@phtunder.com", role: "coach", region: "Mid-Atlantic" }).returning();
  const [coachSam] = await db.insert(users).values({ username: "coach_sam", password: coachPw2, name: "Sam Ortega", email: "sam.ortega@dmvlegends.com", role: "coach", region: "DMV" }).returning();
  const [refUser1] = await db.insert(users).values({ username: "ref_james", password: fanPw, name: "James Holloway", email: "ref.james@meca7v7.com", role: "referee", region: "Northeast" }).returning();
  const [refUser2] = await db.insert(users).values({ username: "ref_carlos", password: fanPw, name: "Carlos Vega", email: "ref.carlos@meca7v7.com", role: "referee", region: "Mid-Atlantic" }).returning();

  await db.insert(coachTeams).values({ userId: coachRon.id, teamId: teams18U[1].id, approved: true });
  await db.insert(coachTeams).values({ userId: coachSam.id, teamId: teams18U[2].id, approved: true });

  const [tyreseUser] = await db.insert(users).values({ username: "tyrese_j", password: playerPw2, name: "Tyrese Jackson", email: "tyrese.j@phtunder.com", role: "player", region: "Mid-Atlantic", playerId: tyreseJackson.id, teamId: teams18U[1].id, playerLinkApproved: true }).returning();
  const [jordanUser] = await db.insert(users).values({ username: "jordan_lee", password: playerPw2, name: "Jordan Lee", email: "jordan.lee@atlblaze.com", role: "player", region: "Southeast", playerId: jordanLee.id, teamId: teams18U[3].id, playerLinkApproved: true }).returning();
  const [justinUser] = await db.insert(users).values({ username: "justin_b", password: playerPw2, name: "Justin Barrow", email: "justin.b@pme.com", role: "player", region: "Northeast", playerId: justinBarrow.id, teamId: teams18U[4].id, playerLinkApproved: true }).returning();
  const [kevinUser] = await db.insert(users).values({ username: "kevin_rb22", password: playerPw2, name: "Kevin Brown", email: "kevin.brown@dmvlegends.com", role: "player", region: "DMV", playerId: kevinBrown.id, teamId: teams18U[2].id, playerLinkApproved: true }).returning();

  // === MORE EXTERNAL LINKS ===
  await db.insert(playerExternalLinks).values([
    { playerId: quincyAdams.id, platform: "twitter", url: "https://twitter.com/quincy_qb10", ogTitle: "Quincy Adams (@quincy_qb10)", ogDescription: "DMV Legends QB | 19 TDs | High IQ | Class of 2026", ogImage: null },
    { playerId: quincyAdams.id, platform: "instagram", url: "https://instagram.com/qadams_qb", ogTitle: "Quincy Adams (@qadams_qb)", ogDescription: "Gonzaga College HS | DMV Legends | 7v7 life", ogImage: null },
    { playerId: elijahForte.id, platform: "twitter", url: "https://twitter.com/elijah_forte6", ogTitle: "Elijah Forte (@elijah_forte6)", ogDescription: "DMV Legends DB | Ball Hawk | 6 INTs | Class of 2028", ogImage: null },
    { playerId: chrisDavis.id, platform: "twitter", url: "https://twitter.com/cdavis_qb9", ogTitle: "Chris Davis (@cdavis_qb9)", ogDescription: "ATL Blaze QB | Dual Threat | Class of 2027", ogImage: null },
    { playerId: chrisDavis.id, platform: "hudl", url: "https://www.hudl.com/profile/chrisdavis9", ogTitle: "Chris Davis - Hudl", ogDescription: "ATL Blaze QB highlights — dual threat with wheels", ogImage: null },
    { playerId: jordanLee.id, platform: "twitter", url: "https://twitter.com/jlee_db4", ogTitle: "Jordan Lee (@jlee_db4)", ogDescription: "ATL Blaze DB | 10 INTs | Lock Island | Class of 2027", ogImage: null },
    { playerId: jordanLee.id, platform: "instagram", url: "https://instagram.com/jordan_lockdown4", ogTitle: "Jordan Lee (@jordan_lockdown4)", ogDescription: "ATL Blaze | Shutdown Corner | Woodward Academy", ogImage: null },
    { playerId: jordanLee.id, platform: "hudl", url: "https://www.hudl.com/profile/jordanlee-db", ogTitle: "Jordan Lee - Hudl", ogDescription: "10 INT season highlights — best DB in the circuit", ogImage: null },
    { playerId: milesFoster.id, platform: "twitter", url: "https://twitter.com/miles_fly8", ogTitle: "Miles Foster (@miles_fly8)", ogDescription: "ATL Blaze WR | Deep Threat | 4.38 forty | Class of 2028", ogImage: null },
    { playerId: milesFoster.id, platform: "instagram", url: "https://instagram.com/milesfoster_wr", ogTitle: "Miles Foster (@milesfoster_wr)", ogDescription: "ATL Blaze WR | Grayson HS | All Gas No Brakes", ogImage: null },
    { playerId: justinBarrow.id, platform: "twitter", url: "https://twitter.com/justinbarrow_1", ogTitle: "Justin Barrow (@justinbarrow_1)", ogDescription: "PME QB | 2x MVP | Bergen Catholic | Class of 2027", ogImage: null },
    { playerId: justinBarrow.id, platform: "instagram", url: "https://instagram.com/jbarrow_qb", ogTitle: "Justin Barrow (@jbarrow_qb)", ogDescription: "Playmakers Elite QB | 2x Tournament MVP | 16 TDs", ogImage: null },
    { playerId: treyMack.id, platform: "instagram", url: "https://instagram.com/treymack_wr13", ogTitle: "Trey Mack (@treymack_wr13)", ogDescription: "PME WR | Big Play Machine | Paramus Catholic | Class of 2028", ogImage: null },
    { playerId: danteYoung.id, platform: "twitter", url: "https://twitter.com/danteyoung_db24", ogTitle: "Dante Young (@danteyoung_db24)", ogDescription: "PME DB | 5 INTs | 3.5 GPA | Class of 2027", ogImage: null },
    { playerId: tylerRobinson.id, platform: "instagram", url: "https://instagram.com/tyler_rob88", ogTitle: "Tyler Robinson (@tyler_rob88)", ogDescription: "FL Hurricanes WR | Clutch Hands | American Heritage", ogImage: null },
    { playerId: damienCruz.id, platform: "instagram", url: "https://instagram.com/damien_cruz5", ogTitle: "Damien Cruz (@damien_cruz5)", ogDescription: "FL Hurricanes QB | Flanagan HS | Class of 2027", ogImage: null },
    { playerId: damienCruz.id, platform: "hudl", url: "https://www.hudl.com/profile/damiencruz5", ogTitle: "Damien Cruz - Hudl", ogDescription: "FL Hurricanes QB — 15 TDs, smart decision maker", ogImage: null },
    { playerId: jamalHarris.id, platform: "twitter", url: "https://twitter.com/jamal_harris12", ogTitle: "Jamal Harris (@jamal_harris12)", ogDescription: "Flight300 QB | Gunslinger | Class of 2027", ogImage: null },
    { playerId: jamalHarris.id, platform: "instagram", url: "https://instagram.com/jharris_qb12", ogTitle: "Jamal Harris (@jharris_qb12)", ogDescription: "Flight300 QB | 14 TDs | Throwing darts", ogImage: null },
    { playerId: coreySims.id, platform: "twitter", url: "https://twitter.com/corey_sims80", ogTitle: "Corey Sims (@corey_sims80)", ogDescription: "Flight300 WR | Possession Receiver | Class of 2027", ogImage: null },
    { playerId: jaredCole.id, platform: "twitter", url: "https://twitter.com/jaredcole_qb15", ogTitle: "Jared Cole (@jaredcole_qb15)", ogDescription: "NJR QB | MVP Season | 17 TDs | Class of 2027", ogImage: null },
    { playerId: jaredCole.id, platform: "instagram", url: "https://instagram.com/jcole_qb15", ogTitle: "Jared Cole (@jcole_qb15)", ogDescription: "NJ Rated QB | St. Joseph Regional | Competitor", ogImage: null },
    { playerId: marcusReed.id, platform: "instagram", url: "https://instagram.com/marcus_reed9", ogTitle: "Marcus Reed (@marcus_reed9)", ogDescription: "NJR WR | 10 TDs | Class of 2028", ogImage: null },
    { playerId: isaacTorres.id, platform: "instagram", url: "https://instagram.com/isaac_torres8", ogTitle: "Isaac Torres (@isaac_torres8)", ogDescription: "NYC Titans QB | City Tough | Erasmus Hall | Class of 2027", ogImage: null },
    { playerId: danteReyes.id, platform: "instagram", url: "https://instagram.com/dante_reyes4", ogTitle: "Dante Reyes (@dante_reyes4)", ogDescription: "New Era Elite QB | 14 TDs | Clutch | Class of 2027", ogImage: null },
    { playerId: danteReyes.id, platform: "hudl", url: "https://www.hudl.com/profile/dantereyes4", ogTitle: "Dante Reyes - Hudl", ogDescription: "New Era Elite QB — clutch 4th quarter playmaker", ogImage: null },
  ]);

  // === MORE PLAYER HIGHLIGHTS ===
  await db.insert(playerHighlights).values([
    { playerId: quincyAdams.id, title: "Field General – Season Recap", description: "Quincy Adams orchestrating the DMV Legends offense — 19 TDs, 0 fumbles.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/quincyadams-recap", views: 1180, featured: true },
    { playerId: quincyAdams.id, title: "Combine Numbers Breakdown", description: "Quincy's elite testing: 4.58 forty, 32\" vertical, 4.10 shuttle. Film to match.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/quincyadams-combine", views: 640, featured: false },
    { playerId: chrisDavis.id, title: "Dual Threat Showcase", description: "Chris Davis beating defenses with his legs AND his arm — 8 TDs across 3 playoff games.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/chrisdavis-dualtheat", views: 1070, featured: true },
    { playerId: jordanLee.id, title: "Ball Hawk – All 10 INTs", description: "Every interception from Jordan Lee's historic 10-pick season. Pure instincts.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jordanlee-allints", views: 2340, featured: true },
    { playerId: milesFoster.id, title: "Speed Kills – WR Reel 2025", description: "Miles Foster burning corners all season — 13 TDs and a 4.38 forty to show for it.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/milesfoster-speed", views: 1560, featured: true },
    { playerId: justinBarrow.id, title: "Championship Masterclass", description: "Justin Barrow's championship game film — precise, decisive, and clutch under pressure.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/justinbarrow-champ", views: 2100, featured: true },
    { playerId: treyMack.id, title: "Yards After Catch – WR2 Breakdown", description: "Trey Mack's YAC ability on full display — 11 TDs and not one easy stop.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/treymack-yac", views: 890, featured: false },
    { playerId: danteYoung.id, title: "Press Coverage Reel", description: "Dante Young suffocating top WRs in press — 5 INTs and a dozen pass breakups.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/danteyoung-press", views: 770, featured: true },
    { playerId: jamalHarris.id, title: "Gunslinger Highlights – 14 TDs", description: "Jamal Harris carving up zones and man coverage for Flight300 in 2025.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jamalharris-2025", views: 930, featured: true },
    { playerId: jaredCole.id, title: "NJR Title Run – MVP Reel", description: "Jared Cole's MVP-caliber tournament run — 6 TDs in one day of bracket play.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/jaredcole-title", views: 1410, featured: true },
    { playerId: elijahForte.id, title: "Coverage Skills Film", description: "Elijah Forte's 6-INT season film breakdown — reading routes and attacking the ball.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/elijahforte-film", views: 610, featured: false },
    { playerId: damienCruz.id, title: "Zero Panic QB Reel", description: "Damien Cruz staying cool in tight situations — every game-winning drive of 2025.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/damiencruz-clutch", views: 840, featured: true },
    { playerId: marcusReed.id, title: "Route Running Highlights", description: "Marcus Reed getting open against every coverage — 10 TDs on precise route running.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/marcusreed-routes", views: 690, featured: false },
    { playerId: coreySims.id, title: "Possession WR Film – Flight300", description: "Corey Sims as the anchor of Flight300's passing game — 11 TDs, always open.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/coreysims-film", views: 720, featured: false },
    { playerId: tylerRobinson.id, title: "Clutch Catches Compilation", description: "Tyler Robinson coming up huge in tight games — 10 TDs and zero drops on third down.", thumbnailUrl: null, videoUrl: "https://www.hudl.com/video/tylerrobinson-clutch", views: 810, featured: true },
  ]);

  // === MORE RECRUITING PROFILES (only players not already in original seed) ===
  await db.insert(playerRecruitingProfiles).values([
    { playerId: jamalHarris.id, fortyYard: "4.58", shuttle: "4.12", vertical: "32\"", gpa: "3.3", satScore: "1090", highlights: "14 TDs gunslinger. Big arm, tough kid from the city. Competes every snap.", school: "Thomas Edison HS", state: "NJ", coachName: "Coach Williams", coachEmail: "williams@tedison.org", coachPhone: "(973) 555-0178" },
    { playerId: marcusReed.id, fortyYard: "4.46", shuttle: "3.99", vertical: "36\"", gpa: "3.5", satScore: "1160", highlights: "10 TDs on crisp routes. NJ Rated's #1 target. 4.46 forty, 36\" vertical.", school: "Seton Hall Prep", state: "NJ", coachName: "Coach Reed", coachEmail: "reed@shp.org", coachPhone: "(973) 555-0201" },
    { playerId: coreySims.id, fortyYard: "4.48", shuttle: "4.02", vertical: "35\"", gpa: "3.4", satScore: "1100", highlights: "Possession WR who wins at the catch point. 11 TDs, reliable hands.", school: "Westfield HS", state: "NJ", coachName: "Coach Sims", coachEmail: "sims@westfield.org", coachPhone: "(908) 555-0145" },
    { playerId: danteReyes.id, fortyYard: "4.56", shuttle: "4.10", vertical: "33\"", gpa: "3.5", satScore: "1170", highlights: "New Era Elite's clutch QB. 14 TDs, money in the 4th quarter.", school: "Monroe College Prep", state: "NY", coachName: "Coach Reyes", coachEmail: "reyes@monroeprep.org", coachPhone: "(718) 555-0222" },
  ]);

  // === LIVE 14U POOL PLAY GAMES ===
  const live14UTeams = live14UOrgIdxs.map((i) => team14UByOrg.get(i)!);
  const pp14U = [
    { mn: 1, aIdx: 0, bIdx: 5, sA: 21, sB: 7, winner: 0 as number | null, status: "final" as const },
    { mn: 2, aIdx: 1, bIdx: 4, sA: 14, sB: 14, winner: null as number | null, status: "final" as const },
    { mn: 3, aIdx: 2, bIdx: 3, sA: 7, sB: 0, winner: null as number | null, status: "live" as const },
    { mn: 4, aIdx: 0, bIdx: 3, sA: 7, sB: 14, winner: 3 as number | null, status: "final" as const },
    { mn: 5, aIdx: 1, bIdx: 2, sA: 21, sB: 14, winner: 1 as number | null, status: "live" as const },
    { mn: 6, aIdx: 4, bIdx: 5, sA: 0, sB: 0, winner: null as number | null, status: "scheduled" as const },
  ];
  for (const g of pp14U) {
    await db.insert(games).values({
      tournamentId: liveSpring14U.id,
      roundNumber: 0,
      matchNumber: g.mn,
      roundName: "Pool Play",
      teamAId: live14UTeams[g.aIdx].id,
      teamBId: live14UTeams[g.bIdx].id,
      scoreA: g.sA,
      scoreB: g.sB,
      winnerId: g.winner !== null ? live14UTeams[g.winner].id : null,
      status: g.status,
      scheduledTime: new Date(now.getTime() - 3600000 + g.mn * 1800000),
    });
  }

  // === MORE COMPLETED 18U KICKOFF CLASSIC POOL PLAY ===
  const cQfFull = [
    { mn: 5, aIdx: 0, bIdx: 3, sA: 28, sB: 7, winner: 0 },
    { mn: 6, aIdx: 1, bIdx: 2, sA: 21, sB: 21, winner: null as number | null },
    { mn: 7, aIdx: 4, bIdx: 7, sA: 14, sB: 28, winner: 7 as number | null },
    { mn: 8, aIdx: 5, bIdx: 6, sA: 21, sB: 14, winner: 5 as number | null },
  ];
  for (const g of cQfFull) {
    await db.insert(games).values({
      tournamentId: ct.id, roundNumber: 0, matchNumber: g.mn, roundName: "Pool Play",
      teamAId: cTeams[g.aIdx].id, teamBId: cTeams[g.bIdx].id, scoreA: g.sA, scoreB: g.sB,
      winnerId: g.winner !== null ? cTeams[g.winner].id : null, status: "final",
      scheduledTime: new Date("2026-02-08T08:00:00"),
    });
  }

  // === MORE ACTIVITY EVENTS ===
  await db.insert(activityEvents).values([
    { type: "score", title: "NE Eagles 21, JRK 7 — 14U Pool Play", description: "Northeast Eagles dominate the opener. Strong defensive showing.", tournamentId: liveSpring14U.id },
    { type: "score", title: "PME vs Carolina Wolves — 14U Pool Play Tie", description: "Playmakers Elite and Carolina Wolves play to a 14-14 draw. Both teams advance.", tournamentId: liveSpring14U.id },
    { type: "score", title: "Flight300 leads NYC 7-0 — 14U Pool Play (Live)", description: "Flight300 opening the scoring in the third 14U pool play matchup. Still live!", tournamentId: liveSpring14U.id },
    { type: "score", title: "JRK 14, NE Eagles 7 — 14U Pool Play", description: "Jersey Knights bounce back with a second pool play win over the Eagles.", tournamentId: liveSpring14U.id },
    { type: "score", title: "PME 21, Flight300 14 — 14U Pool Play (Live)", description: "Playmakers Elite pulling ahead late. Flight300 fighting back in the second half.", tournamentId: liveSpring14U.id },
    { type: "announcement", title: "Spring Opener – 14U Pool Play Complete by 3PM", description: "All 14U pool play games scheduled to wrap by 3PM. Bracket announced at 3:30PM.", tournamentId: liveSpring14U.id },
    { type: "result", title: "18U Semifinals: Eagles vs ATL — NE Eagles lead 14-7", description: "Northeast Eagles holding a 14-7 halftime lead over ATL Blaze in the first semi.", tournamentId: liveSpring18U.id },
    { type: "result", title: "18U Championship Set: NE Eagles vs Philly Thunder", description: "The rematch. Northeast Eagles and Philly Thunder will meet in the 18U final.", tournamentId: liveSpring18U.id },
    { type: "announcement", title: "Meca 757 — Registration Now Open", description: "All 3 divisions open for registration. Virginia Beach Sportsplex. April 11-12. Spots filling fast!", tournamentId: meca757_18U.id },
    { type: "announcement", title: "Meca Summer Championship – Early Bird Pricing Ends Soon", description: "Lock in your spot at Bader Field, Atlantic City. Biggest prize pool on the East Coast.", tournamentId: mecaSummer_18U.id },
    { type: "result", title: "Kickoff Classic 18U – Marcus Thompson Named MVP", description: "Northeast Eagles QB Marcus Thompson takes home the MVP trophy after a dominant championship performance.", tournamentId: ct.id },
    { type: "result", title: "Kickoff Classic 15U – Pool Play Recap", description: "NE Eagles went 3-0 in pool play to top the 15U bracket. Philly Thunder went 2-1 to earn the #2 seed.", tournamentId: completedKickoff15U.id },
    { type: "announcement", title: "Meca DE – Registration Opening Soon", description: "Mark your calendars. DE Turf Sports Complex, Frederica DE. May 16-17. All age groups.", tournamentId: mecaDE_18U.id },
    { type: "score", title: "NE Eagles 15U 21, WNM 14 — 15U Pool Play", description: "Northeast Eagles 15U looking sharp in pool play. Strong QB play to start the day.", tournamentId: liveSpring15U.id },
  ]);

  // === NOTIFICATIONS FOR NEW USERS ===
  await db.insert(notifications).values([
    { userId: tyreseUser.id, type: "system", title: "Welcome to Meca!", message: "Your account is linked to your Philly Thunder QB profile. Let's go!", read: false },
    { userId: tyreseUser.id, type: "tournament", title: "Spring Opener 18U is LIVE", message: "Philly Thunder is competing now at MetLife. Good luck, Tyrese!", read: false },
    { userId: jordanUser.id, type: "system", title: "Welcome to Meca!", message: "Your account is linked to your ATL Blaze DB profile. Stay locked in.", read: false },
    { userId: jordanUser.id, type: "tournament", title: "Spring Opener 18U is LIVE", message: "ATL Blaze is competing now. Jordan, go get some picks!", read: false },
    { userId: justinUser.id, type: "system", title: "Welcome to Meca!", message: "Justin Barrow — PME's 2x MVP is in the building. Profile linked!", read: true },
    { userId: justinUser.id, type: "tournament", title: "Spring Opener 18U is LIVE", message: "Playmakers Elite is on the clock. Go be great.", read: false },
    { userId: kevinUser.id, type: "system", title: "Welcome to Meca!", message: "Kevin Brown — 1000 yards and counting. DMV Legends profile linked.", read: true },
    { userId: kevinUser.id, type: "tournament", title: "Spring Opener 18U is LIVE", message: "DMV Legends is live. Run it, Kevin!", read: false },
    { userId: fanJess.id, type: "system", title: "Welcome to Meca!", message: "Follow your favorite teams and players to get live score notifications.", read: false },
    { userId: fanDre.id, type: "system", title: "Welcome to Meca!", message: "Check out the live Spring Opener bracket happening today!", read: false },
    { userId: fanCorey.id, type: "system", title: "Welcome to Meca!", message: "Live scores, brackets, and standings — all in one place. Welcome!", read: false },
    { userId: coachRon.id, type: "system", title: "Welcome, Coach!", message: "Your coach account is set up and linked to Philly Thunder 18U. Manage your roster from the Profile tab.", read: false },
    { userId: coachSam.id, type: "system", title: "Welcome, Coach!", message: "Your coach account is set up and linked to DMV Legends 18U. Good luck at the Spring Opener!", read: false },
    { userId: refUser1.id, type: "system", title: "Referee Account Active", message: "James, your Meca referee account is active. Check your assigned games.", read: false },
    { userId: refUser2.id, type: "system", title: "Referee Account Active", message: "Carlos, your Meca referee account is active. See you at MetLife!", read: false },
  ]);

  const totalTeams = teams18U.length + teams15UArr.length + teams14UArr.length;
  const totalPlayers = insertedPlayers18U.length + players15UData.length + players14UData.length;
  const totalGames = qfGames.length + sfGames.length + champGame.length + pp15U.length + pp14U.length + cQf.length + cSf.length + cFinal.length + c15Qf.length + c15Sf.length + c15Final.length + cQfFull.length;
  console.log("Database seeded successfully!");
  console.log(`  ${totalTeams} teams (${teams18U.length} 18U, ${teams15UArr.length} 15U, ${teams14UArr.length} 14U)`);
  console.log(`  ${totalPlayers} players (${insertedPlayers18U.length} 18U, ${players15UData.length} 15U, ${players14UData.length} 14U)`);
  console.log(`  17 tournaments (2 completed, 3 live, 12 upcoming)`);
  console.log(`  ${totalGames} games`);
  console.log(`  68 external links, 42 highlights, 29 recruiting profiles`);
  console.log(`  20 user accounts (admin, coaches, referees, spectators, players)`);
}
