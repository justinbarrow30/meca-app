import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { db } from "./db";
import { pool } from "./db";
import {
  users, teams, players, tournaments, games, fields,
  tournamentTeams, divisions, orders, auditLogs, activityEvents,
  gamePlayerStats, playerHighlights, playerExternalLinks, playerRecruitingProfiles,
  notifications, follows, teamExternalLinks, coachTeams, playerBadges,
} from "@shared/schema";
import { eq, desc, asc, and, sql, or, ilike, inArray } from "drizzle-orm";
import { hashPassword, verifyPassword, requireAuth, requireRole } from "./auth";
import { processTeamEloUpdate, processPlayerEloUpdate, applyTournamentMvpBonus } from "./elo";
import { createAuditLog } from "./audit";
import { fetchOGMetadata } from "./og-fetcher";
import { seedDatabase } from "./seed";
import { cache, TTL } from "./cache";

const PgSession = connectPgSimple(session);

async function notifyFollowers(
  targetType: "team" | "tournament" | "player",
  targetId: string,
  type: string,
  title: string,
  message: string,
  relatedId?: string,
  relatedType?: string,
  excludeUserIds?: Set<string>,
): Promise<string[]> {
  try {
    const followerRows = await db.select().from(follows)
      .where(and(eq(follows.targetType, targetType), eq(follows.targetId, targetId)));
    if (followerRows.length === 0) return [];
    const uniqueFollowers = excludeUserIds
      ? followerRows.filter(f => !excludeUserIds.has(f.userId))
      : followerRows;
    if (uniqueFollowers.length === 0) return [];
    const notifValues = uniqueFollowers.map(f => ({
      userId: f.userId,
      type,
      title,
      message,
      relatedId: relatedId || targetId,
      relatedType: relatedType || targetType,
    }));
    await db.insert(notifications).values(notifValues);
    return uniqueFollowers.map(f => f.userId);
  } catch (e) {
    console.error("notifyFollowers error:", e);
    return [];
  }
}

async function notifyTeamFollowers(teamAId: string | null, teamBId: string | null, type: string, title: string, message: string, relatedId?: string, excludeUserIds?: Set<string>): Promise<Set<string>> {
  const notifiedUsers = new Set<string>(excludeUserIds || []);
  if (teamAId) {
    const users = await notifyFollowers("team", teamAId, type, title, message, relatedId, "game", notifiedUsers);
    users.forEach(u => notifiedUsers.add(u));
  }
  if (teamBId) {
    const users = await notifyFollowers("team", teamBId, type, title, message, relatedId, "game", notifiedUsers);
    users.forEach(u => notifiedUsers.add(u));
  }
  return notifiedUsers;
}

async function notifyPlayerFollowersForTeams(teamAId: string | null, teamBId: string | null, type: string, title: string, message: string, relatedId?: string, excludeUserIds?: Set<string>): Promise<Set<string>> {
  const notifiedUsers = new Set<string>(excludeUserIds || []);
  try {
    const teamIds = [teamAId, teamBId].filter(Boolean) as string[];
    if (teamIds.length === 0) return notifiedUsers;
    const teamPlayers = await db.select().from(players).where(inArray(players.teamId, teamIds));
    for (const player of teamPlayers) {
      const users = await notifyFollowers("player", player.id, type, title, message, relatedId, "game", notifiedUsers);
      users.forEach(u => notifiedUsers.add(u));
    }
  } catch (e) {
    console.error("notifyPlayerFollowersForTeams error:", e);
  }
  return notifiedUsers;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 15,
      }),
      secret: process.env.SESSION_SECRET || "meca-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: isProduction,
        httpOnly: true,
        sameSite: "lax",
      },
    })
  );

  if (process.env.NODE_ENV !== "production" || process.env.SEED === "true") {
    await seedDatabase();
  } else {
    console.log("Production mode: skipping seed (set SEED=true to force)");
  }

  // ─── AUTH ────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, role, teamId, playerId } = req.body;
      if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
      if (!password) return res.status(400).json({ error: "Password is required" });

      const emailLower = email.toLowerCase().trim();
      const existing = await db.select().from(users).where(eq(users.email, emailLower));
      if (existing.length > 0) return res.status(409).json({ error: "An account with this email already exists" });

      const username = emailLower;
      const hashedPw = await hashPassword(password);
      const userRole = role || "spectator";
      const coachTeamId = userRole === "coach" ? null : (teamId || null);
      const needsApproval = (userRole === "player" && (coachTeamId || playerId));
      const [user] = await db.insert(users).values({
        username,
        password: hashedPw,
        name: name.trim(),
        email: emailLower,
        role: userRole,
        teamId: coachTeamId,
        playerId: playerId || null,
        playerLinkApproved: needsApproval ? false : true,
      }).returning();

      req.session.userId = user.id;
      req.session.role = user.role;
      const { password: _, ...userWithoutPw } = user;
      res.status(201).json(userWithoutPw);
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password, username } = req.body;
      let user;

      if (username) {
        const [found] = await db.select().from(users).where(eq(users.username, username));
        user = found;
      } else if (email) {
        const emailLower = email.toLowerCase().trim();
        const [found] = await db.select().from(users).where(eq(users.email, emailLower));
        user = found;
      } else {
        return res.status(400).json({ error: "Email is required" });
      }

      if (!user) return res.status(401).json({ error: "No account found with this email" });

      if (!password) return res.status(400).json({ error: "Password is required" });
      if (user.password && user.password !== "") {
        const valid = await verifyPassword(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid credentials - incorrect password" });
      }

      req.session.userId = user.id;
      req.session.role = user.role;
      const { password: _, ...userWithoutPw } = user;
      res.json(userWithoutPw);
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) return res.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
      const token = Date.now().toString(36) + Math.random().toString(36).substr(2, 12);
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      await db.update(users).set({ passwordResetToken: token, passwordResetExpiry: expiry }).where(eq(users.id, user.id));
      const response: any = { success: true, message: "If an account exists with that email, a reset link has been sent." };
      if (process.env.NODE_ENV !== "production") {
        response.resetToken = token;
      }
      res.json(response);
    } catch (err) {
      console.error("Forgot password error:", err);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required" });
      if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
      if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      const hashed = await hashPassword(newPassword);
      await db.update(users).set({
        password: hashed,
        passwordResetToken: null,
        passwordResetExpiry: null,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.json(null);
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    if (!user) return res.json(null);
    const { password: _, ...userWithoutPw } = user;
    res.json(userWithoutPw);
  });

  app.put("/api/auth/profile", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const { name, role, teamId, playerId } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (role !== undefined) updates.role = role;
      if (teamId !== undefined) updates.teamId = teamId || null;
      if (playerId !== undefined) updates.playerId = playerId || null;

      const [updated] = await db.update(users).set(updates).where(eq(users.id, req.session.userId)).returning();
      if (!updated) return res.status(404).json({ error: "User not found" });
      const { password: _, ...userWithoutPw } = updated;
      res.json(userWithoutPw);
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ─── TOURNAMENTS ────────────────────────────────────
  app.get("/api/tournaments", async (_req: Request, res: Response) => {
    try {
      const cached = cache.get("tournaments:all");
      if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

      const [allTournaments, allTournamentTeams, allFields] = await Promise.all([
        db.select().from(tournaments).orderBy(tournaments.startDate),
        db.select().from(tournamentTeams),
        db.select().from(fields),
      ]);

      const ttByTournament = new Map<string, string[]>();
      for (const tt of allTournamentTeams) {
        if (!ttByTournament.has(tt.tournamentId)) ttByTournament.set(tt.tournamentId, []);
        ttByTournament.get(tt.tournamentId)!.push(tt.teamId);
      }

      const fieldsByTournament = new Map<string, typeof allFields>();
      for (const f of allFields) {
        if (!fieldsByTournament.has(f.tournamentId)) fieldsByTournament.set(f.tournamentId, []);
        fieldsByTournament.get(f.tournamentId)!.push(f);
      }

      const result = allTournaments.map(t => ({
        ...t,
        registeredTeams: ttByTournament.get(t.id) || [],
        fields: fieldsByTournament.get(t.id) || [],
      }));

      cache.set("tournaments:all", result, TTL.TOURNAMENTS);
      res.json(result);
    } catch (err) {
      console.error("Error fetching tournaments:", err);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/tournaments/:id", async (req: Request, res: Response) => {
    try {
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, req.params.id));
      if (!t) return res.status(404).json({ error: "Tournament not found" });

      const regTeams = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, t.id));
      const tFields = await db.select().from(fields).where(eq(fields.tournamentId, t.id));
      const tGames = await db.select().from(games).where(eq(games.tournamentId, t.id)).orderBy(asc(games.roundNumber), asc(games.matchNumber));

      const roundsMap = new Map<string, { roundNumber: number; name: string; matches: typeof tGames }>();
      for (const g of tGames) {
        const key = g.roundName || `Round ${g.roundNumber}`;
        if (!roundsMap.has(key)) {
          roundsMap.set(key, { roundNumber: g.roundNumber, name: key, matches: [] });
        }
        roundsMap.get(key)!.matches.push(g);
      }

      let champion: string | null = null;
      const roundOrder: Record<string, number> = { "Pool Play": 0, "Wildcard": 1, "Quarterfinal": 2, "Semifinal": 3, "Championship": 4 };
      const allRounds = Array.from(roundsMap.values()).sort((a, b) => {
        const orderA = roundOrder[a.name] ?? a.roundNumber;
        const orderB = roundOrder[b.name] ?? b.roundNumber;
        return orderA - orderB;
      });
      if (allRounds.length > 0) {
        const lastRound = allRounds[allRounds.length - 1];
        const finalGame = lastRound.matches.find(m => {
          const rn = (m.roundName || "").toLowerCase();
          return rn.includes("championship") || rn.includes("final");
        }) || lastRound.matches[0];
        if (finalGame?.winnerId) champion = finalGame.winnerId;
      }

      const bracket = tGames.length > 0 ? {
        id: `bracket-${t.id}`,
        tournamentId: t.id,
        rounds: allRounds,
        champion,
      } : null;

      res.json({
        ...t,
        registeredTeams: regTeams.map(rt => rt.teamId),
        fields: tFields,
        bracket,
      });
    } catch (err) {
      console.error("Error fetching tournament:", err);
      res.status(500).json({ error: "Failed to fetch tournament" });
    }
  });

  app.get("/api/tournaments/:id/siblings", async (req: Request, res: Response) => {
    try {
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, req.params.id));
      if (!t) return res.status(404).json({ error: "Tournament not found" });

      const baseName = t.name.replace(/\s*-\s*(14U|15U|18U|Open)\s*$/i, "").trim();

      const allTournaments = await db.select({
        id: tournaments.id,
        name: tournaments.name,
        ageGroup: tournaments.ageGroup,
        status: tournaments.status,
      }).from(tournaments);

      const siblings = allTournaments.filter(sib => {
        const sibBase = sib.name.replace(/\s*-\s*(14U|15U|18U|Open)\s*$/i, "").trim();
        return sibBase === baseName && sib.id !== t.id && sib.ageGroup;
      });

      if (siblings.length === 0 || !t.ageGroup) {
        return res.json([]);
      }

      const all = [{ id: t.id, name: t.name, ageGroup: t.ageGroup, status: t.status }, ...siblings];
      const ageOrder = ["14U", "15U", "18U", "Open"];
      all.sort((a, b) => ageOrder.indexOf(a.ageGroup || "") - ageOrder.indexOf(b.ageGroup || ""));

      res.json(all);
    } catch (err) {
      console.error("Error fetching tournament siblings:", err);
      res.status(500).json({ error: "Failed to fetch siblings" });
    }
  });

  app.post("/api/tournaments", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, description, location, region, startDate, endDate, teamCount, poolPlayGames, bracketFormat, entryFee, prizePool, ageGroup, ageGroups } = req.body;

      const ageGroupList: string[] | null = Array.isArray(ageGroups) && ageGroups.length > 0 ? ageGroups : null;

      const createOne = async (tournamentName: string, ag: string | null) => {
        const [t] = await db.insert(tournaments).values({
          name: tournamentName, description, location, region,
          startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null,
          teamCount: teamCount || 8, poolPlayGames: poolPlayGames || 3,
          bracketFormat: bracketFormat || null,
          ageGroup: ag || null,
          entryFee, prizePool,
          createdBy: req.session.userId!,
        }).returning();

        await db.insert(fields).values([
          { tournamentId: t.id, name: "Field A" },
          { tournamentId: t.id, name: "Field B" },
        ]);

        await createAuditLog("tournament_created", req.session.userId!, "tournament", t.id, { name: tournamentName, ageGroup: ag });
        return t;
      };

      if (ageGroupList) {
        const created = [];
        for (const ag of ageGroupList) {
          const t = await createOne(`${name} - ${ag}`, ag);
          created.push(t);
        }
        res.status(201).json(created);
      } else {
        const t = await createOne(name, ageGroup || null);
        res.status(201).json(t);
      }
    } catch (err) {
      console.error("Error creating tournament:", err);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  app.put("/api/tournaments/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, description, location, region, startDate, endDate, status, teamCount, poolPlayGames, bracketFormat, entryFee, prizePool, ageGroup } = req.body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (location !== undefined) updates.location = location;
      if (region !== undefined) updates.region = region;
      if (startDate !== undefined) updates.startDate = new Date(startDate);
      if (endDate !== undefined) updates.endDate = new Date(endDate);
      if (status !== undefined) updates.status = status;
      if (teamCount !== undefined) updates.teamCount = teamCount;
      if (poolPlayGames !== undefined) updates.poolPlayGames = poolPlayGames;
      if (bracketFormat !== undefined) updates.bracketFormat = bracketFormat;
      if (entryFee !== undefined) updates.entryFee = entryFee;
      if (prizePool !== undefined) updates.prizePool = prizePool;
      if (ageGroup !== undefined) updates.ageGroup = ageGroup;
      updates.updatedAt = new Date();

      const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, req.params.id));
      const [updated] = await db.update(tournaments).set(updates).where(eq(tournaments.id, req.params.id)).returning();
      await createAuditLog("tournament_updated", req.session.userId!, "tournament", req.params.id, updates);

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update tournament" });
    }
  });

  app.post("/api/tournaments/:id/teams", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { teamId } = req.body;
      if (!teamId) return res.status(400).json({ error: "Team ID is required" });
      const existing = await db.select().from(tournamentTeams)
        .where(and(eq(tournamentTeams.tournamentId, req.params.id), eq(tournamentTeams.teamId, teamId)));
      if (existing.length > 0) return res.status(400).json({ error: "Team is already registered" });
      const [entry] = await db.insert(tournamentTeams).values({
        tournamentId: req.params.id,
        teamId,
      }).returning();
      await createAuditLog("team_registered", req.session.userId!, "tournament", req.params.id, { teamId });
      res.status(201).json(entry);
    } catch (err) {
      console.error("Register team error:", err);
      res.status(500).json({ error: "Failed to register team" });
    }
  });

  app.delete("/api/tournaments/:id/teams/:teamId", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await db.delete(tournamentTeams)
        .where(and(eq(tournamentTeams.tournamentId, req.params.id), eq(tournamentTeams.teamId, req.params.teamId)));
      await createAuditLog("team_unregistered", req.session.userId!, "tournament", req.params.id, { teamId: req.params.teamId });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove team" });
    }
  });

  // ─── TOURNAMENT FIELDS ──────────────────────────────
  app.post("/api/tournaments/:id/fields", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: "Field name is required" });
      const [field] = await db.insert(fields).values({
        tournamentId: req.params.id,
        name: name.trim(),
      }).returning();
      await createAuditLog("field_added", req.session.userId!, "tournament", req.params.id, { fieldName: name.trim() });
      res.status(201).json(field);
    } catch (err) {
      console.error("Add field error:", err);
      res.status(500).json({ error: "Failed to add field" });
    }
  });

  app.delete("/api/tournaments/:id/fields/:fieldId", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await db.delete(fields).where(and(eq(fields.id, req.params.fieldId), eq(fields.tournamentId, req.params.id)));
      await createAuditLog("field_removed", req.session.userId!, "tournament", req.params.id, { fieldId: req.params.fieldId });
      res.json({ success: true });
    } catch (err) {
      console.error("Remove field error:", err);
      res.status(500).json({ error: "Failed to remove field" });
    }
  });

  // ─── TOURNAMENT STANDINGS ──────────────────────────────
  app.get("/api/tournaments/:id/standings", async (req: Request, res: Response) => {
    try {
      const tournamentId = req.params.id;
      const tournamentGames = await db.select().from(games)
        .where(and(eq(games.tournamentId, tournamentId), eq(games.status, "final")));

      const standingsMap = new Map<string, {
        teamId: string;
        wins: number;
        losses: number;
        ties: number;
        pointsFor: number;
        pointsAgainst: number;
        gamesPlayed: number;
      }>();

      const initTeam = (teamId: string) => {
        if (!standingsMap.has(teamId)) {
          standingsMap.set(teamId, { teamId, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0 });
        }
        return standingsMap.get(teamId)!;
      };

      for (const g of tournamentGames) {
        if (!g.teamAId || !g.teamBId) continue;
        const sA = g.scoreA ?? 0;
        const sB = g.scoreB ?? 0;
        const a = initTeam(g.teamAId);
        const b = initTeam(g.teamBId);
        a.gamesPlayed++;
        b.gamesPlayed++;
        a.pointsFor += sA;
        a.pointsAgainst += sB;
        b.pointsFor += sB;
        b.pointsAgainst += sA;
        if (g.winnerId === g.teamAId) { a.wins++; b.losses++; }
        else if (g.winnerId === g.teamBId) { b.wins++; a.losses++; }
        else { a.ties++; b.ties++; }
      }

      const ttEntries = await db.select().from(tournamentTeams)
        .where(eq(tournamentTeams.tournamentId, tournamentId));
      for (const tt of ttEntries) {
        initTeam(tt.teamId);
      }

      const teamIds = Array.from(standingsMap.keys());
      const relevantTeams = teamIds.length > 0
        ? await db.select().from(teams).where(inArray(teams.id, teamIds))
        : [];
      const teamsById = new Map(relevantTeams.map(t => [t.id, t]));

      const standings = Array.from(standingsMap.values())
        .sort((a, b) => {
          const winPctA = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
          const winPctB = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
          if (winPctB !== winPctA) return winPctB - winPctA;
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.pointsFor - a.pointsFor;
        })
        .map((s, i) => {
          const team = teamsById.get(s.teamId);
          return {
            rank: i + 1,
            teamId: s.teamId,
            teamName: team?.name || "Unknown",
            teamColor: team?.color || "#888",
            logoInitials: team?.logoInitials || "??",
            wins: s.wins,
            losses: s.losses,
            ties: s.ties,
            pointsFor: s.pointsFor,
            pointsAgainst: s.pointsAgainst,
            pointDifferential: s.pointsFor - s.pointsAgainst,
            gamesPlayed: s.gamesPlayed,
          };
        });

      res.json(standings);
    } catch (err) {
      console.error("Tournament standings error:", err);
      res.status(500).json({ error: "Failed to get standings" });
    }
  });

  // ─── TEAMS ──────────────────────────────────────────
  app.get("/api/teams", async (_req: Request, res: Response) => {
    try {
      const cached = cache.get("teams:all");
      if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

      const allTeams = await db.select().from(teams).orderBy(desc(teams.elo));
      cache.set("teams:all", allTeams, TTL.TEAMS);
      res.json(allTeams);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/:id", async (req: Request, res: Response) => {
    try {
      const [team] = await db.select().from(teams).where(eq(teams.id, req.params.id));
      if (!team) return res.status(404).json({ error: "Team not found" });

      const roster = await db.select().from(players).where(eq(players.teamId, team.id));
      res.json({ ...team, roster });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  app.post("/api/teams", requireRole("admin", "coach"), async (req: Request, res: Response) => {
    try {
      const { name, abbreviation, color, secondaryColor, logoInitials, region } = req.body;
      const [team] = await db.insert(teams).values({
        name, abbreviation, color, secondaryColor, logoInitials, region,
        coachId: req.session.userId!,
        approved: true,
      }).returning();

      await createAuditLog("team_created", req.session.userId!, "team", team.id, { name });
      res.status(201).json(team);
    } catch (err) {
      console.error("Create team error:", err);
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  app.put("/api/teams/:id/approve", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const [updated] = await db.update(teams).set({ approved: true, updatedAt: new Date() }).where(eq(teams.id, req.params.id)).returning();
      await createAuditLog("team_approved", req.session.userId!, "team", req.params.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to approve team" });
    }
  });

  app.post("/api/teams/:id/players", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const teamId = req.params.id;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(401).json({ error: "User not found" });

      const isAdmin = user.role === "admin";
      let isApprovedCoach = false;
      if (user.role === "coach") {
        const [ct] = await db.select().from(coachTeams).where(and(eq(coachTeams.userId, userId), eq(coachTeams.teamId, teamId), eq(coachTeams.approved, true)));
        isApprovedCoach = !!ct;
      }
      if (!isAdmin && !isApprovedCoach) {
        return res.status(403).json({ error: "Only approved coaches can manage their team roster" });
      }

      const { name, position, number } = req.body;
      if (!name || !position || number === undefined) {
        return res.status(400).json({ error: "Name, position, and number are required" });
      }

      const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
      if (!team) return res.status(404).json({ error: "Team not found" });

      const [player] = await db.insert(players).values({
        name: name.trim(),
        position,
        number: parseInt(number, 10),
        teamId,
        region: team.region || "Northeast",
      }).returning();

      await createAuditLog("player_added_to_roster", userId, "player", player.id, { name, teamId });

      res.status(201).json(player);
    } catch (err) {
      console.error("Add player to team error:", err);
      res.status(500).json({ error: "Failed to add player" });
    }
  });

  app.delete("/api/teams/:id/players/:playerId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const teamId = req.params.id;
      const playerId = req.params.playerId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(401).json({ error: "User not found" });

      const isAdmin = user.role === "admin";
      let isApprovedCoach = false;
      if (user.role === "coach") {
        const [ct] = await db.select().from(coachTeams).where(and(eq(coachTeams.userId, userId), eq(coachTeams.teamId, teamId), eq(coachTeams.approved, true)));
        isApprovedCoach = !!ct;
      }
      if (!isAdmin && !isApprovedCoach) {
        return res.status(403).json({ error: "Only approved coaches can manage their team roster" });
      }

      const [player] = await db.select().from(players).where(and(eq(players.id, playerId), eq(players.teamId, teamId)));
      if (!player) return res.status(404).json({ error: "Player not found on this team" });

      await db.delete(players).where(eq(players.id, playerId));
      await createAuditLog("player_removed_from_roster", userId, "player", playerId, { playerName: player.name, teamId });

      res.json({ success: true });
    } catch (err) {
      console.error("Remove player from team error:", err);
      res.status(500).json({ error: "Failed to remove player" });
    }
  });

  // ─── PLAYERS ────────────────────────────────────────
  app.get("/api/players/available", async (_req: Request, res: Response) => {
    try {
      const linkedUsers = await db.select({ playerId: users.playerId })
        .from(users)
        .where(sql`${users.playerId} IS NOT NULL`);
      const linkedPlayerIds = linkedUsers.map(u => u.playerId).filter(Boolean) as string[];
      let allPlayers;
      if (linkedPlayerIds.length > 0) {
        allPlayers = await db.select().from(players)
          .where(sql`${players.id} NOT IN (${sql.join(linkedPlayerIds.map(id => sql`${id}`), sql`, `)})`)
          .orderBy(asc(players.name));
      } else {
        allPlayers = await db.select().from(players).orderBy(asc(players.name));
      }
      res.json(allPlayers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch available players" });
    }
  });

  app.get("/api/players", async (_req: Request, res: Response) => {
    try {
      const cached = cache.get("players:all");
      if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

      const allPlayers = await db.select().from(players).orderBy(desc(players.elo));
      cache.set("players:all", allPlayers, TTL.PLAYERS);
      res.json(allPlayers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });

  app.get("/api/players/:id", async (req: Request, res: Response) => {
    try {
      const [player] = await db.select().from(players).where(eq(players.id, req.params.id));
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch player" });
    }
  });

  app.post("/api/players", requireRole("admin", "coach"), async (req: Request, res: Response) => {
    try {
      const { name, position, number, teamId, region } = req.body;
      const [player] = await db.insert(players).values({
        name, position, number, teamId, region: region || "Northeast",
      }).returning();

      await createAuditLog("player_created", req.session.userId!, "player", player.id, { name, teamId });
      res.status(201).json(player);
    } catch (err) {
      res.status(500).json({ error: "Failed to create player" });
    }
  });

  app.post("/api/players/:id/claim", requireAuth, async (req: Request, res: Response) => {
    try {
      const playerId = req.params.id;
      const userId = req.session.userId!;

      const [player] = await db.select().from(players).where(eq(players.id, playerId));
      if (!player) return res.status(404).json({ error: "Player not found" });

      const existingClaim = await db.select().from(users)
        .where(and(eq(users.playerId, playerId), sql`${users.id} != ${userId}`));
      if (existingClaim.length > 0) return res.status(409).json({ error: "This player is already claimed by another user" });

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.playerId) return res.status(400).json({ error: "You already have a linked player profile" });

      const [updated] = await db.update(users).set({
        playerId: player.id,
        teamId: player.teamId,
        playerLinkApproved: false,
        updatedAt: new Date(),
      }).where(eq(users.id, userId)).returning();

      if (!updated) return res.status(404).json({ error: "User not found" });

      await createAuditLog("player_claimed", userId, "player", playerId, { playerName: player.name, teamId: player.teamId });

      const { password: _, ...userWithoutPw } = updated;
      res.json(userWithoutPw);
    } catch (err) {
      console.error("Claim player error:", err);
      res.status(500).json({ error: "Failed to claim player" });
    }
  });

  app.post("/api/teams/:id/claim", requireAuth, async (req: Request, res: Response) => {
    try {
      const teamId = req.params.id;
      const userId = req.session.userId!;

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!currentUser) return res.status(404).json({ error: "User not found" });
      if (currentUser.role !== "coach") return res.status(403).json({ error: "Only coaches can claim teams" });

      const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
      if (!team) return res.status(404).json({ error: "Team not found" });

      const existingClaim = await db.select().from(coachTeams)
        .where(and(eq(coachTeams.userId, userId), eq(coachTeams.teamId, teamId)));
      if (existingClaim.length > 0) return res.status(400).json({ error: "You already have a claim for this team" });

      await db.insert(coachTeams).values({ userId, teamId, approved: false });
      await createAuditLog("team_claimed", userId, "team", teamId, { teamName: team.name });

      const myTeams = await db.select().from(coachTeams).where(eq(coachTeams.userId, userId));
      res.json({ success: true, coachTeams: myTeams });
    } catch (err) {
      console.error("Claim team error:", err);
      res.status(500).json({ error: "Failed to claim team" });
    }
  });

  app.get("/api/coach-teams/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const myTeams = await db.select().from(coachTeams).where(eq(coachTeams.userId, userId));
      res.json(myTeams);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch coach teams" });
    }
  });

  app.get("/api/coach-teams/check/:teamId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [entry] = await db.select().from(coachTeams)
        .where(and(eq(coachTeams.userId, userId), eq(coachTeams.teamId, req.params.teamId)));
      res.json(entry || null);
    } catch (err) {
      res.status(500).json({ error: "Failed to check coach team" });
    }
  });

  // ─── GAMES / SCORES ─────────────────────────────────
  app.get("/api/games", async (req: Request, res: Response) => {
    try {
      const { tournamentId, status } = req.query;
      let query = db.select().from(games);
      const conditions = [];
      if (tournamentId) conditions.push(eq(games.tournamentId, tournamentId as string));
      if (status) conditions.push(eq(games.status, status as any));

      const results = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(asc(games.roundNumber), asc(games.matchNumber))
        : await query.orderBy(asc(games.roundNumber), asc(games.matchNumber));
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.get("/api/games/:id", async (req: Request, res: Response) => {
    try {
      const [game] = await db.select().from(games).where(eq(games.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });

      const [teamA, teamB, tournament_row, field, rosterA, rosterB] = await Promise.all([
        game.teamAId ? db.select().from(teams).where(eq(teams.id, game.teamAId)).then(r => r[0]) : null,
        game.teamBId ? db.select().from(teams).where(eq(teams.id, game.teamBId)).then(r => r[0]) : null,
        db.select().from(tournaments).where(eq(tournaments.id, game.tournamentId)).then(r => r[0]),
        game.fieldId ? db.select().from(fields).where(eq(fields.id, game.fieldId)).then(r => r[0]) : null,
        game.teamAId ? db.select().from(players).where(eq(players.teamId, game.teamAId)) : [],
        game.teamBId ? db.select().from(players).where(eq(players.teamId, game.teamBId)) : [],
      ]);

      res.json({
        ...game,
        teamA: teamA ? { ...teamA, roster: rosterA } : null,
        teamB: teamB ? { ...teamB, roster: rosterB } : null,
        tournament: tournament_row ? { id: tournament_row.id, name: tournament_row.name } : null,
        field: field ? { id: field.id, name: field.name } : null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch game" });
    }
  });

  app.post("/api/games", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { tournamentId, teamAId, teamBId, roundNumber, roundName, fieldId, scheduledTime } = req.body;
      if (!tournamentId) return res.status(400).json({ error: "Tournament is required" });

      const [game] = await db.insert(games).values({
        tournamentId,
        teamAId: teamAId || null,
        teamBId: teamBId || null,
        roundNumber: roundNumber || 1,
        roundName: roundName || null,
        fieldId: fieldId || null,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        status: "scheduled",
        scoreA: 0,
        scoreB: 0,
      }).returning();

      await createAuditLog("game_created", req.session.userId!, "game", game.id);
      res.status(201).json(game);
    } catch (err) {
      console.error("Create game error:", err);
      res.status(500).json({ error: "Failed to create game" });
    }
  });

  app.put("/api/games/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const [game] = await db.select().from(games).where(eq(games.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });

      const { teamAId, teamBId, roundNumber, roundName, fieldId, scheduledTime, scoreA, scoreB, status } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (teamAId !== undefined) updates.teamAId = teamAId || null;
      if (teamBId !== undefined) updates.teamBId = teamBId || null;
      if (roundNumber !== undefined) updates.roundNumber = roundNumber;
      if (roundName !== undefined) updates.roundName = roundName || null;
      if (fieldId !== undefined) updates.fieldId = fieldId || null;
      if (scheduledTime !== undefined) updates.scheduledTime = scheduledTime ? new Date(scheduledTime) : null;
      if (scoreA !== undefined) updates.scoreA = scoreA;
      if (scoreB !== undefined) updates.scoreB = scoreB;
      if (status !== undefined) updates.status = status;

      const [updated] = await db.update(games).set(updates).where(eq(games.id, req.params.id)).returning();
      await createAuditLog("game_updated", req.session.userId!, "game", req.params.id);
      res.json(updated);
    } catch (err) {
      console.error("Update game error:", err);
      res.status(500).json({ error: "Failed to update game" });
    }
  });

  app.delete("/api/games/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await db.delete(games).where(eq(games.id, req.params.id));
      await createAuditLog("game_deleted", req.session.userId!, "game", req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete game" });
    }
  });

  app.put("/api/games/:id/score", requireRole("admin", "referee"), async (req: Request, res: Response) => {
    try {
      const { scoreA, scoreB } = req.body;
      if (scoreA === undefined || scoreB === undefined) return res.status(400).json({ error: "Scores required" });

      const [game] = await db.select().from(games).where(eq(games.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (game.status === "locked") return res.status(400).json({ error: "Game is locked" });

      const [updated] = await db.update(games).set({
        scoreA, scoreB, status: "live", updatedAt: new Date(),
        startedAt: game.startedAt || new Date(),
      }).where(eq(games.id, req.params.id)).returning();

      cache.invalidate("tournaments");
      cache.invalidate("games");

      await createAuditLog("score_updated", req.session.userId!, "game", req.params.id, { scoreA, scoreB, previous: { scoreA: game.scoreA, scoreB: game.scoreB } });

      if (game.status === "scheduled" && game.teamAId && game.teamBId) {
        const [[tA], [tB]] = await Promise.all([
          db.select().from(teams).where(eq(teams.id, game.teamAId)),
          db.select().from(teams).where(eq(teams.id, game.teamBId)),
        ]);
        const roundLabel = game.roundName || "Game";
        const notifiedUsers = await notifyTeamFollowers(game.teamAId, game.teamBId, "game_started",
          `${roundLabel} is Live!`,
          `${tA?.name || "Team"} vs ${tB?.name || "Team"} has kicked off.`,
          game.id);

        const allNotified = await notifyPlayerFollowersForTeams(game.teamAId, game.teamBId, "game_started",
          `${roundLabel} is Live!`,
          `${tA?.name || "Team"} vs ${tB?.name || "Team"} has kicked off.`,
          game.id, notifiedUsers);

        if (game.tournamentId) {
          const rn = (game.roundName || "").toLowerCase();
          const isBracket = rn.includes("quarterfinal") || rn.includes("semifinal") || rn.includes("championship") || rn === "final" || rn === "finals" || rn.includes("wildcard") || rn.includes("round of 16") || rn.includes("first round");

          if (isBracket) {
            const bracketGames = await db.select().from(games).where(
              and(eq(games.tournamentId, game.tournamentId), sql`round_name IS NOT NULL AND round_name != ''`)
            );
            const liveBracketGames = bracketGames.filter(g => g.status === "live" || g.status === "final");
            if (liveBracketGames.length <= 1) {
              const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, game.tournamentId));
              await notifyFollowers("tournament", game.tournamentId, "bracket_live",
                `Bracket Play is Live!`,
                `${tournament?.name || "Tournament"} bracket play has begun. ${tA?.name || "Team"} vs ${tB?.name || "Team"} kicks it off!`,
                game.tournamentId, "tournament", allNotified);
            }
          } else {
            const poolGames = await db.select().from(games).where(
              and(eq(games.tournamentId, game.tournamentId), sql`(round_name IS NULL OR round_name = '' OR round_name LIKE 'Pool%' OR round_name LIKE 'Game%')`)
            );
            const livePoolGames = poolGames.filter(g => g.status === "live" || g.status === "final");
            if (livePoolGames.length <= 1) {
              const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, game.tournamentId));
              await notifyFollowers("tournament", game.tournamentId, "pool_play_live",
                `Pool Play is Live!`,
                `${tournament?.name || "Tournament"} pool play has begun!`,
                game.tournamentId, "tournament", allNotified);
            }
          }
        }
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update score" });
    }
  });

  app.put("/api/games/:id/finalize", requireRole("admin", "referee"), async (req: Request, res: Response) => {
    try {
      const [game] = await db.select().from(games).where(eq(games.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!game.teamAId || !game.teamBId) return res.status(400).json({ error: "Both teams required" });
      if (game.scoreA === null || game.scoreB === null) return res.status(400).json({ error: "Scores required" });
      if (game.status === "locked") return res.status(400).json({ error: "Game already locked" });

      const isTie = (game.scoreA ?? 0) === (game.scoreB ?? 0);
      const rn = (game.roundName || "").toLowerCase();
      const isBracketGame = !!game.nextGameId || rn.includes("championship") || rn === "final" || rn === "finals" ||
        rn.includes("quarterfinal") || rn.includes("semifinal") || rn.includes("wildcard") || rn.includes("round of 16") || rn.includes("first round");

      if (isTie && isBracketGame) {
        return res.status(400).json({ error: "Bracket games cannot end in a tie. Update the score before finalizing." });
      }

      const winnerId = isTie ? null : (game.scoreA! > game.scoreB! ? game.teamAId : game.teamBId);
      const loserId = isTie ? null : (winnerId === game.teamAId ? game.teamBId : game.teamAId);

      const updated = await db.transaction(async (tx) => {
        if (!game.eloProcessed && winnerId && loserId) {
          const winnerScore = winnerId === game.teamAId ? game.scoreA : game.scoreB;
          const loserScore = winnerId === game.teamAId ? game.scoreB : game.scoreA;
          await processTeamEloUpdate(winnerId, loserId, winnerScore, loserScore, tx);
          await processPlayerEloUpdate(winnerId, loserId, winnerScore, loserScore, tx);
        }

        const [updatedGame] = await tx.update(games).set({
          winnerId, status: "final", eloProcessed: !isTie,
          endedAt: new Date(), updatedAt: new Date(),
        }).where(eq(games.id, req.params.id)).returning();

        if (winnerId && game.nextGameId && game.nextGameSlot) {
          const slotCol = game.nextGameSlot === "A" ? "teamAId" : "teamBId";
          await tx.update(games).set({
            [slotCol === "teamAId" ? "teamAId" : "teamBId"]: winnerId,
            updatedAt: new Date(),
          }).where(eq(games.id, game.nextGameId));
        }

        const roundName = (game.roundName || "").toLowerCase();
        const isChampionshipGame = roundName.includes("championship") || (roundName === "final" || roundName === "finals");
        if (isChampionshipGame && winnerId) {
          const [winnerTeam] = await tx.select().from(teams).where(eq(teams.id, winnerId!));
          const [loserTeam] = loserId ? await tx.select().from(teams).where(eq(teams.id, loserId)) : [null];
          await tx.insert(activityEvents).values({
            type: "result",
            title: `${winnerTeam?.name || "Unknown"} Wins ${game.roundName || "Championship"}!`,
            description: `${winnerTeam?.name || "Unknown"} defeats ${loserTeam?.name || "Unknown"} ${game.scoreA}-${game.scoreB} to win the championship.`,
            tournamentId: game.tournamentId,
            gameId: game.id,
          });
        }

        return updatedGame;
      });

      cache.invalidateAll();

      await createAuditLog("game_finalized", req.session.userId!, "game", req.params.id, { winnerId, scoreA: game.scoreA, scoreB: game.scoreB });

      const [teamA] = game.teamAId ? await db.select().from(teams).where(eq(teams.id, game.teamAId)) : [null as any];
      const [teamB] = game.teamBId ? await db.select().from(teams).where(eq(teams.id, game.teamBId)) : [null as any];
      const roundLabel = game.roundName || "Game";

      let notifTitle: string;
      let notifMsg: string;
      if (isTie) {
        notifTitle = `${roundLabel} Final Score`;
        notifMsg = `${teamA?.name || "Team"} ties ${teamB?.name || "Team"} ${game.scoreA}-${game.scoreB}`;
      } else {
        const winTeam = winnerId === game.teamAId ? teamA : teamB;
        const loseTeam = winnerId === game.teamAId ? teamB : teamA;
        const isChamp = (game.roundName || "").toLowerCase().includes("championship") || (game.roundName || "").toLowerCase() === "final" || (game.roundName || "").toLowerCase() === "finals";
        notifTitle = isChamp
          ? `🏆 ${winTeam?.name || "Team"} Wins the Championship!`
          : `${roundLabel} Final Score`;
        notifMsg = `${winTeam?.name || "Team"} defeats ${loseTeam?.name || "Team"} ${game.scoreA}-${game.scoreB}`;
      }

      const notifiedUsers = await notifyTeamFollowers(game.teamAId, game.teamBId, "game_result", notifTitle, notifMsg, game.id);

      const allNotified = await notifyPlayerFollowersForTeams(game.teamAId, game.teamBId, "game_result", notifTitle, notifMsg, game.id, notifiedUsers);

      if (game.tournamentId) {
        const rnLower = (game.roundName || "").toLowerCase();
        const isSemifinal = rnLower.includes("semifinal");
        const isChamp = rnLower.includes("championship") || rnLower === "final" || rnLower === "finals";

        if (isChamp && winnerId) {
          const winTeam = winnerId === game.teamAId ? teamA : teamB;
          await notifyFollowers("tournament", game.tournamentId, "champion",
            `🏆 ${winTeam?.name || "Team"} Wins the Championship!`,
            `${winTeam?.name || "Team"} defeats ${(winnerId === game.teamAId ? teamB : teamA)?.name || "Team"} ${game.scoreA}-${game.scoreB} to win it all!`,
            game.id, "game", allNotified);
        } else if (isSemifinal && winnerId) {
          const winTeam = winnerId === game.teamAId ? teamA : teamB;
          await notifyFollowers("tournament", game.tournamentId, "semifinal_result",
            `${winTeam?.name || "Team"} Headed to the Championship!`,
            `${winTeam?.name || "Team"} advances after defeating ${(winnerId === game.teamAId ? teamB : teamA)?.name || "Team"} ${game.scoreA}-${game.scoreB}.`,
            game.id, "game", allNotified);
        }
      }

      res.json(updated);
    } catch (err) {
      console.error("Finalize error:", err);
      res.status(500).json({ error: "Failed to finalize game" });
    }
  });

  app.put("/api/games/:id/status", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const validTransitions: Record<string, string[]> = {
        scheduled: ["live", "cancelled"],
        live: ["final", "cancelled"],
        final: ["locked"],
      };

      const [game] = await db.select().from(games).where(eq(games.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });

      const allowed = validTransitions[game.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `Cannot transition from ${game.status} to ${status}` });
      }

      const [updated] = await db.update(games).set({ status, updatedAt: new Date() }).where(eq(games.id, req.params.id)).returning();
      await createAuditLog("game_status_changed", req.session.userId!, "game", req.params.id, { from: game.status, to: status });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update game status" });
    }
  });

  // ─── DELETE ENDPOINTS ──────────────────────────────
  app.delete("/api/teams/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await db.delete(players).where(eq(players.teamId, req.params.id));
      await db.delete(tournamentTeams).where(eq(tournamentTeams.teamId, req.params.id));
      await db.delete(teams).where(eq(teams.id, req.params.id));
      await createAuditLog("team_deleted", req.session.userId!, "team", req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  app.delete("/api/players/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await db.delete(players).where(eq(players.id, req.params.id));
      await createAuditLog("player_deleted", req.session.userId!, "player", req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete player" });
    }
  });

  app.delete("/api/tournaments/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await db.delete(games).where(eq(games.tournamentId, req.params.id));
      await db.delete(fields).where(eq(fields.tournamentId, req.params.id));
      await db.delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, req.params.id));
      await db.delete(tournaments).where(eq(tournaments.id, req.params.id));
      await createAuditLog("tournament_deleted", req.session.userId!, "tournament", req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  app.post("/api/admin/clear-all", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      await db.delete(activityEvents);
      await db.delete(games);
      await db.delete(fields);
      await db.delete(tournamentTeams);
      await db.delete(divisions);
      await db.delete(players);
      await db.delete(tournaments);
      await db.delete(teams);
      await db.delete(orders);
      await db.delete(auditLogs);
      await createAuditLog("all_data_cleared", req.session.userId!, undefined, undefined);
      res.json({ success: true });
    } catch (err) {
      console.error("Clear all error:", err);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });

  app.put("/api/teams/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role || "";
      if (userRole === "admin") {
      } else if (userRole === "coach") {
        const [ct] = await db.select().from(coachTeams).where(and(eq(coachTeams.userId, userId), eq(coachTeams.teamId, req.params.id), eq(coachTeams.approved, true)));
        if (!ct) {
          return res.status(403).json({ error: "You can only edit your own team" });
        }
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const { name, abbreviation, color, secondaryColor, logoInitials, region } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name) updates.name = name;
      if (abbreviation) updates.abbreviation = abbreviation;
      if (color) updates.color = color;
      if (secondaryColor) updates.secondaryColor = secondaryColor;
      if (logoInitials) updates.logoInitials = logoInitials;
      if (region !== undefined) updates.region = region;
      const [updated] = await db.update(teams).set(updates).where(eq(teams.id, req.params.id)).returning();
      await createAuditLog("team_updated", req.session.userId!, "team", req.params.id, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  // ─── TEAM EXTERNAL LINKS ──────────────────────────────
  app.get("/api/teams/:id/external-links", async (req: Request, res: Response) => {
    try {
      const links = await db.select().from(teamExternalLinks)
        .where(eq(teamExternalLinks.teamId, req.params.id))
        .orderBy(asc(teamExternalLinks.createdAt));
      res.json(links);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch team links" });
    }
  });

  app.post("/api/teams/:id/external-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role || "";
      if (userRole === "admin") {
      } else if (userRole === "coach") {
        const [ct] = await db.select().from(coachTeams).where(and(eq(coachTeams.userId, userId), eq(coachTeams.teamId, req.params.id), eq(coachTeams.approved, true)));
        if (!ct) {
          return res.status(403).json({ error: "You can only edit your own team" });
        }
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const { platform, url, label } = req.body;
      if (!platform || !url) return res.status(400).json({ error: "Platform and URL are required" });
      const [link] = await db.insert(teamExternalLinks).values({
        teamId: req.params.id,
        platform,
        url,
        label: label || null,
      }).returning();
      res.status(201).json(link);
    } catch (err) {
      res.status(500).json({ error: "Failed to add team link" });
    }
  });

  app.delete("/api/teams/:id/external-links/:linkId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role || "";
      if (userRole === "admin") {
      } else if (userRole === "coach") {
        const [ct] = await db.select().from(coachTeams).where(and(eq(coachTeams.userId, userId), eq(coachTeams.teamId, req.params.id), eq(coachTeams.approved, true)));
        if (!ct) {
          return res.status(403).json({ error: "You can only edit your own team" });
        }
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      await db.delete(teamExternalLinks)
        .where(and(eq(teamExternalLinks.id, req.params.linkId), eq(teamExternalLinks.teamId, req.params.id)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove team link" });
    }
  });

  app.put("/api/players/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, position, number, teamId, region, touchdowns, interceptions, gamesPlayed, wins, mvpAwards } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name) updates.name = name;
      if (position) updates.position = position;
      if (number !== undefined) updates.number = number;
      if (teamId) updates.teamId = teamId;
      if (region) updates.region = region;
      if (touchdowns !== undefined) updates.touchdowns = parseInt(touchdowns);
      if (interceptions !== undefined) updates.interceptions = parseInt(interceptions);
      if (gamesPlayed !== undefined) updates.gamesPlayed = parseInt(gamesPlayed);
      if (wins !== undefined) updates.wins = parseInt(wins);
      if (mvpAwards !== undefined) updates.mvpAwards = parseInt(mvpAwards);
      const [updated] = await db.update(players).set(updates).where(eq(players.id, req.params.id)).returning();
      await createAuditLog("player_updated", req.session.userId!, "player", req.params.id, updates);
      res.json(updated);
    } catch (err) {
      console.error("Update player error:", err);
      res.status(500).json({ error: "Failed to update player" });
    }
  });

  // ─── RANKINGS ───────────────────────────────────────
  app.get("/api/rankings/teams", async (req: Request, res: Response) => {
    try {
      const { region, ageGroup } = req.query;
      const cacheKey = `rankings:teams:${region || "all"}:${ageGroup || "all"}`;
      const cached = cache.get(cacheKey);
      if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

      const conditions: any[] = [];
      if (region) conditions.push(eq(teams.region, region as string));
      if (ageGroup) conditions.push(eq(teams.ageGroup, ageGroup as string));

      const ranked = conditions.length > 0
        ? await db.select().from(teams).where(and(...conditions)).orderBy(desc(teams.elo))
        : await db.select().from(teams).orderBy(desc(teams.elo));

      const result = ranked.map((t, i) => ({
        rank: i + 1, teamId: t.id, name: t.name, elo: t.elo,
        change: 0,
        region: t.region, record: { wins: t.wins, losses: t.losses, ties: t.ties },
      }));
      cache.set(cacheKey, result, TTL.RANKINGS);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch team rankings" });
    }
  });

  app.get("/api/rankings/players", async (req: Request, res: Response) => {
    try {
      const { region, ageGroup } = req.query;
      const cacheKey = `rankings:players:${region || "all"}:${ageGroup || "all"}`;
      const cached = cache.get(cacheKey);
      if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

      const conditions: any[] = [];
      if (region) conditions.push(eq(players.region, region as string));

      let ranked;
      if (ageGroup) {
        const ageTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.ageGroup, ageGroup as string));
        const teamIds = ageTeams.map(t => t.id);
        if (teamIds.length === 0) return res.json([]);
        conditions.push(inArray(players.teamId, teamIds));
        ranked = await db.select().from(players).where(and(...conditions)).orderBy(desc(players.elo));
      } else {
        ranked = conditions.length > 0
          ? await db.select().from(players).where(and(...conditions)).orderBy(desc(players.elo))
          : await db.select().from(players).orderBy(desc(players.elo));
      }

      const eligible = ranked.filter(p => p.gamesPlayed >= 3);
      const result = eligible.map((p, i) => ({
        rank: i + 1, playerId: p.id, name: p.name, elo: p.elo,
        change: 0,
        region: p.region, position: p.position, teamId: p.teamId,
        gamesPlayed: p.gamesPlayed,
      }));
      cache.set(cacheKey, result, TTL.RANKINGS);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch player rankings" });
    }
  });

  // ─── TOURNAMENT MVP ────────────────────────────────
  app.post("/api/players/:id/mvp-bonus", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const playerId = req.params.id;
      const [player] = await db.select().from(players).where(eq(players.id, playerId));
      if (!player) return res.status(404).json({ error: "Player not found" });

      const newElo = await applyTournamentMvpBonus(playerId);
      await createAuditLog("mvp_bonus_applied", req.session.userId!, "player", playerId, {
        previousElo: player.elo,
        newElo,
        bonus: 25,
      });

      res.json({ success: true, playerId, previousElo: player.elo, newElo, bonus: 25 });
    } catch (err) {
      console.error("Error applying MVP bonus:", err);
      res.status(500).json({ error: "Failed to apply MVP bonus" });
    }
  });

  // ─── ACTIVITY FEED ──────────────────────────────────
  app.get("/api/activity", async (_req: Request, res: Response) => {
    try {
      const cached = cache.get("activity:feed");
      if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

      const allowedTypes = ["result", "announcement", "schedule"];
      const events = await db.select().from(activityEvents).orderBy(desc(activityEvents.createdAt)).limit(50);
      const filtered = events.filter(e => allowedTypes.includes(e.type));
      const result = filtered.slice(0, 20);
      cache.set("activity:feed", result, TTL.ACTIVITY);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  app.post("/api/activity", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { type, title, description, tournamentId } = req.body;
      if (!title || !description) return res.status(400).json({ error: "Title and description are required" });
      const validTypes = ["announcement", "schedule", "result"];
      const eventType = validTypes.includes(type) ? type : "announcement";
      const [event] = await db.insert(activityEvents).values({
        type: eventType,
        title,
        description,
        tournamentId: tournamentId || null,
      }).returning();
      await createAuditLog("announcement_created", req.session.userId!, "activity", event.id, { title, type: eventType });

      if (eventType === "announcement") {
        const allUsers = await db.select({ id: users.id }).from(users);
        if (allUsers.length > 0) {
          const notifValues = allUsers.map(u => ({
            userId: u.id,
            type: "announcement",
            title,
            message: description,
            relatedId: event.id,
            relatedType: "activity",
          }));
          await db.insert(notifications).values(notifValues);
        }
      }

      res.json(event);
    } catch (err) {
      console.error("Error creating announcement:", err);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  // ─── NOTIFICATIONS ──────────────────────────────────
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const userNotifs = await db.select().from(notifications)
        .where(eq(notifications.userId, req.session.userId!))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      res.json(userNotifs);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const [result] = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, req.session.userId!), eq(notifications.read, false)));
      res.json({ count: Number(result?.count || 0) });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.put("/api/notifications/mark-read", requireAuth, async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        await db.update(notifications).set({ read: true })
          .where(and(eq(notifications.userId, req.session.userId!), inArray(notifications.id, ids)));
      } else {
        await db.update(notifications).set({ read: true })
          .where(eq(notifications.userId, req.session.userId!));
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  // ─── FOLLOWS ──────────────────────────────────────────
  app.get("/api/follows/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const userFollows = await db.select().from(follows)
        .where(eq(follows.userId, req.session.userId!))
        .orderBy(desc(follows.createdAt));
      res.json(userFollows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch follows" });
    }
  });

  async function getTournamentSiblingIds(tournamentId: string): Promise<string[]> {
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!t || !t.ageGroup) return [tournamentId];
    const baseName = t.name.replace(/\s*-\s*(14U|15U|18U|Open)\s*$/i, "").trim();
    const allTournaments = await db.select({ id: tournaments.id, name: tournaments.name, ageGroup: tournaments.ageGroup }).from(tournaments);
    const siblings = allTournaments.filter(sib => {
      const sibBase = sib.name.replace(/\s*-\s*(14U|15U|18U|Open)\s*$/i, "").trim();
      return sibBase === baseName && sib.ageGroup;
    });
    return siblings.length > 0 ? siblings.map(s => s.id) : [tournamentId];
  }

  app.post("/api/follows", requireAuth, async (req: Request, res: Response) => {
    try {
      const { targetType, targetId } = req.body;
      if (!targetType || !targetId) return res.status(400).json({ error: "targetType and targetId required" });
      if (!["player", "team", "tournament"].includes(targetType)) return res.status(400).json({ error: "Invalid target type" });

      if (targetType === "tournament") {
        const siblingIds = await getTournamentSiblingIds(targetId);
        const results = [];
        for (const sibId of siblingIds) {
          const existing = await db.select().from(follows)
            .where(and(eq(follows.userId, req.session.userId!), eq(follows.targetType, "tournament"), eq(follows.targetId, sibId)));
          if (existing.length === 0) {
            const [f] = await db.insert(follows).values({ userId: req.session.userId!, targetType: "tournament", targetId: sibId }).returning();
            results.push(f);
          } else {
            results.push(existing[0]);
          }
        }
        res.json(results[0]);
      } else {
        const existing = await db.select().from(follows)
          .where(and(eq(follows.userId, req.session.userId!), eq(follows.targetType, targetType), eq(follows.targetId, targetId)));
        if (existing.length > 0) return res.json(existing[0]);
        const [f] = await db.insert(follows).values({ userId: req.session.userId!, targetType, targetId }).returning();
        res.json(f);
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to follow" });
    }
  });

  app.delete("/api/follows/:targetType/:targetId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { targetType, targetId } = req.params;

      if (targetType === "tournament") {
        const siblingIds = await getTournamentSiblingIds(targetId);
        for (const sibId of siblingIds) {
          await db.delete(follows).where(
            and(eq(follows.userId, req.session.userId!), eq(follows.targetType, "tournament"), eq(follows.targetId, sibId))
          );
        }
      } else {
        await db.delete(follows).where(
          and(eq(follows.userId, req.session.userId!), eq(follows.targetType, targetType), eq(follows.targetId, targetId))
        );
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to unfollow" });
    }
  });

  app.get("/api/follows/check/:targetType/:targetId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { targetType, targetId } = req.params;

      if (targetType === "tournament") {
        const siblingIds = await getTournamentSiblingIds(targetId);
        const existing = await db.select().from(follows)
          .where(and(
            eq(follows.userId, req.session.userId!),
            eq(follows.targetType, "tournament"),
            inArray(follows.targetId, siblingIds)
          ));
        res.json({ following: existing.length > 0 });
      } else {
        const existing = await db.select().from(follows)
          .where(and(eq(follows.userId, req.session.userId!), eq(follows.targetType, targetType), eq(follows.targetId, targetId)));
        res.json({ following: existing.length > 0 });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to check follow" });
    }
  });

  // ─── POOL PLAY GENERATION ────────────────────────────
  app.post("/api/tournaments/:id/pool-play", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, req.params.id));
      if (!t) return res.status(404).json({ error: "Tournament not found" });

      const regTeams = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, t.id));
      if (regTeams.length < 2) return res.status(400).json({ error: "Need at least 2 teams" });

      const existingPoolPlay = await db.select().from(games).where(
        and(eq(games.tournamentId, t.id), eq(games.roundName, "Pool Play"))
      );
      if (existingPoolPlay.length > 0) {
        await db.delete(games).where(
          and(eq(games.tournamentId, t.id), eq(games.roundName, "Pool Play"))
        );
      }

      const teamIds = regTeams.map(rt => rt.teamId);
      const poolGamesPerTeam = t.poolPlayGames || 3;
      const tFields = await db.select().from(fields).where(eq(fields.tournamentId, t.id));

      const matchups: Array<{ teamA: string; teamB: string }> = [];
      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
          matchups.push({ teamA: teamIds[i], teamB: teamIds[j] });
        }
      }

      const teamGameCounts = new Map<string, number>();
      teamIds.forEach(id => teamGameCounts.set(id, 0));
      const selectedMatchups: typeof matchups = [];

      const shuffled = matchups.sort(() => Math.random() - 0.5);
      for (const m of shuffled) {
        const aCount = teamGameCounts.get(m.teamA) || 0;
        const bCount = teamGameCounts.get(m.teamB) || 0;
        if (aCount < poolGamesPerTeam && bCount < poolGamesPerTeam) {
          selectedMatchups.push(m);
          teamGameCounts.set(m.teamA, aCount + 1);
          teamGameCounts.set(m.teamB, bCount + 1);
        }
      }

      const baseTime = t.startDate ? new Date(t.startDate) : new Date();
      baseTime.setHours(8, 0, 0, 0);
      const gameDuration = 30;

      const poolGames = selectedMatchups.map((m, idx) => ({
        tournamentId: t.id,
        roundNumber: 0,
        matchNumber: idx + 1,
        roundName: "Pool Play",
        teamAId: m.teamA,
        teamBId: m.teamB,
        status: "scheduled" as const,
        scoreA: 0,
        scoreB: 0,
        fieldId: tFields.length > 0 ? tFields[idx % tFields.length].id : null,
        scheduledTime: new Date(baseTime.getTime() + Math.floor(idx / Math.max(tFields.length, 1)) * gameDuration * 60000),
      }));

      if (poolGames.length > 0) {
        await db.insert(games).values(poolGames);
      }

      await createAuditLog("pool_play_generated", req.session.userId!, "tournament", t.id, {
        gamesCreated: poolGames.length,
        teamsCount: teamIds.length,
        gamesPerTeam: poolGamesPerTeam,
      });

      res.json({ success: true, gamesCreated: poolGames.length });
    } catch (err) {
      console.error("Error generating pool play:", err);
      res.status(500).json({ error: "Failed to generate pool play games" });
    }
  });

  // ─── PLAYER LINK APPROVAL ────────────────────────────
  app.get("/api/admin/pending-players", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const pendingPlayers = await db.select().from(users).where(
        and(
          eq(users.role, "player"),
          eq(users.playerLinkApproved, false)
        )
      );
      const playerResults = pendingPlayers.filter(u => u.playerId).map(u => {
        const { password: _, ...safe } = u;
        return { ...safe, pendingType: "player" };
      });

      const pendingCoachTeams = await db.select().from(coachTeams).where(eq(coachTeams.approved, false));
      const coachResults = [];
      for (const ct of pendingCoachTeams) {
        const [u] = await db.select().from(users).where(eq(users.id, ct.userId));
        const [team] = await db.select().from(teams).where(eq(teams.id, ct.teamId));
        if (u) {
          const { password: _, ...safe } = u;
          coachResults.push({ ...safe, teamId: ct.teamId, teamName: team?.name || "Unknown", coachTeamId: ct.id, pendingType: "coach" });
        }
      }

      res.json([...playerResults, ...coachResults]);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch pending players" });
    }
  });

  app.put("/api/admin/approve-player/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { coachTeamId } = req.body || {};

      if (coachTeamId) {
        const [ct] = await db.update(coachTeams).set({ approved: true })
          .where(eq(coachTeams.id, coachTeamId)).returning();
        if (!ct) return res.status(404).json({ error: "Coach team claim not found" });

        const [u] = await db.select().from(users).where(eq(users.id, ct.userId));
        const [team] = await db.select().from(teams).where(eq(teams.id, ct.teamId));
        await createAuditLog("coach_team_approved", req.session.userId!, "team", ct.teamId);

        await db.insert(notifications).values({
          userId: ct.userId,
          type: "player_approved",
          title: "Team Linked!",
          message: `Your claim for ${team?.name || "the team"} has been approved. You can now manage the roster.`,
          relatedId: ct.teamId,
          relatedType: "team",
        });

        const { password: _, ...safe } = u!;
        return res.json(safe);
      }

      const [updated] = await db.update(users).set({
        playerLinkApproved: true,
        updatedAt: new Date(),
      }).where(eq(users.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "User not found" });
      await createAuditLog("player_link_approved", req.session.userId!, "user", req.params.id);

      let playerName = "your player profile";
      if (updated.playerId) {
        const [player] = await db.select().from(players).where(eq(players.id, updated.playerId));
        if (player) playerName = player.name;
      }
      await db.insert(notifications).values({
        userId: updated.id,
        type: "player_approved",
        title: "Account Linked!",
        message: `Your account has been linked to ${playerName}. You now have full access to your player profile.`,
        relatedId: updated.playerId || undefined,
        relatedType: "player",
      });

      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      res.status(500).json({ error: "Failed to approve player" });
    }
  });

  app.put("/api/admin/reject-player/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { coachTeamId } = req.body || {};

      if (coachTeamId) {
        const [ct] = await db.select().from(coachTeams).where(eq(coachTeams.id, coachTeamId));
        await db.delete(coachTeams).where(eq(coachTeams.id, coachTeamId));
        await createAuditLog("coach_team_rejected", req.session.userId!, "team", ct?.teamId || coachTeamId);
        return res.json({ success: true });
      }

      const [updated] = await db.update(users).set({
        playerId: null,
        teamId: null,
        playerLinkApproved: false,
        updatedAt: new Date(),
      }).where(eq(users.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "User not found" });
      await createAuditLog("player_link_rejected", req.session.userId!, "user", req.params.id);
      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      res.status(500).json({ error: "Failed to reject player" });
    }
  });

  // ─── BRACKET MANAGEMENT ───────────────────────────────
  app.post("/api/tournaments/:id/bracket", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { slots } = req.body;
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, req.params.id));
      if (!t) return res.status(404).json({ error: "Tournament not found" });

      const existingGames = await db.select().from(games).where(eq(games.tournamentId, t.id));
      const elimGames = existingGames.filter(g => {
        const rn = (g.roundName || "").toLowerCase();
        return rn.includes("quarterfinal") || rn.includes("semifinal") || rn.includes("championship") || rn.includes("wildcard") || rn.includes("round of 16") || rn.includes("first round");
      });
      if (elimGames.length > 0) {
        await db.delete(games).where(
          and(
            eq(games.tournamentId, t.id),
            inArray(games.id, elimGames.map(g => g.id))
          )
        );
      }

      if (!slots || !Array.isArray(slots)) return res.status(400).json({ error: "Slots array is required" });

      const numTeams = slots.length;
      if (numTeams < 2) return res.status(400).json({ error: "Need at least 2 teams" });
      const supportedCounts = [2, 3, 4, 6, 8, 10, 12, 14, 16];
      if (!supportedCounts.includes(numTeams)) return res.status(400).json({ error: `${numTeams} teams not supported. Supported: ${supportedCounts.join(", ")}` });

      interface BracketMatchup { seedA: number | null; seedB: number | null; wcIndex?: number; }
      interface RoundSpec { roundName: string; matchups: BracketMatchup[]; }
      const rounds: RoundSpec[] = [];

      if (numTeams <= 4) {
        const sfMatchups: BracketMatchup[] = [];
        if (numTeams === 2) sfMatchups.push({ seedA: 0, seedB: 1 });
        else if (numTeams === 3) {
          sfMatchups.push({ seedA: 0, seedB: null });
          sfMatchups.push({ seedA: 1, seedB: 2 });
        } else {
          sfMatchups.push({ seedA: 0, seedB: 3 });
          sfMatchups.push({ seedA: 1, seedB: 2 });
        }
        rounds.push({ roundName: "Semifinal", matchups: sfMatchups });
        rounds.push({ roundName: "Championship", matchups: [{ seedA: null, seedB: null }] });
      } else if (numTeams === 6) {
        rounds.push({ roundName: "First Round", matchups: [
          { seedA: 2, seedB: 5 },
          { seedA: 3, seedB: 4 },
        ]});
        rounds.push({ roundName: "Semifinal", matchups: [
          { seedA: 0, seedB: null },
          { seedA: 1, seedB: null },
        ]});
        rounds.push({ roundName: "Championship", matchups: [{ seedA: null, seedB: null }] });
      } else if (numTeams === 8) {
        rounds.push({ roundName: "Quarterfinal", matchups: [
          { seedA: 0, seedB: 7 },
          { seedA: 3, seedB: 4 },
          { seedA: 2, seedB: 5 },
          { seedA: 1, seedB: 6 },
        ]});
        rounds.push({ roundName: "Semifinal", matchups: [
          { seedA: null, seedB: null },
          { seedA: null, seedB: null },
        ]});
        rounds.push({ roundName: "Championship", matchups: [{ seedA: null, seedB: null }] });
      } else if (numTeams <= 16) {
        if (numTeams === 10) {
          rounds.push({ roundName: "Wildcard", matchups: [
            { seedA: 6, seedB: 9 },
            { seedA: 7, seedB: 8 },
          ]});
          rounds.push({ roundName: "Quarterfinal", matchups: [
            { seedA: 0, seedB: null },
            { seedA: 3, seedB: 4 },
            { seedA: 2, seedB: 5 },
            { seedA: 1, seedB: null },
          ]});
        } else if (numTeams === 12) {
          rounds.push({ roundName: "Wildcard", matchups: [
            { seedA: 4, seedB: 11 },
            { seedA: 7, seedB: 8 },
            { seedA: 5, seedB: 10 },
            { seedA: 6, seedB: 9 },
          ]});
          rounds.push({ roundName: "Quarterfinal", matchups: [
            { seedA: 0, seedB: null },
            { seedA: 3, seedB: null },
            { seedA: 2, seedB: null },
            { seedA: 1, seedB: null },
          ]});
        } else if (numTeams === 14) {
          rounds.push({ roundName: "Wildcard", matchups: [
            { seedA: 2, seedB: 13 },
            { seedA: 7, seedB: 8 },
            { seedA: 5, seedB: 10 },
            { seedA: 4, seedB: 11 },
            { seedA: 3, seedB: 12 },
            { seedA: 6, seedB: 9 },
          ]});
          rounds.push({ roundName: "Quarterfinal", matchups: [
            { seedA: 0, seedB: null },
            { seedA: null, seedB: null },
            { seedA: null, seedB: null },
            { seedA: 1, seedB: null },
          ]});
        } else if (numTeams === 16) {
          rounds.push({ roundName: "Round of 16", matchups: [
            { seedA: 0, seedB: 15 },
            { seedA: 7, seedB: 8 },
            { seedA: 4, seedB: 11 },
            { seedA: 3, seedB: 12 },
            { seedA: 5, seedB: 10 },
            { seedA: 2, seedB: 13 },
            { seedA: 6, seedB: 9 },
            { seedA: 1, seedB: 14 },
          ]});
          rounds.push({ roundName: "Quarterfinal", matchups: [
            { seedA: null, seedB: null },
            { seedA: null, seedB: null },
            { seedA: null, seedB: null },
            { seedA: null, seedB: null },
          ]});
        }
        rounds.push({ roundName: "Semifinal", matchups: [
          { seedA: null, seedB: null },
          { seedA: null, seedB: null },
        ]});
        rounds.push({ roundName: "Championship", matchups: [{ seedA: null, seedB: null }] });
      } else {
        return res.status(400).json({ error: "Maximum 16 teams supported" });
      }

      const insertedByRound: Map<string, any[]> = new Map();

      let roundNumber = 1;
      for (const rd of rounds) {
        const roundGames: any[] = [];
        for (let i = 0; i < rd.matchups.length; i++) {
          const m = rd.matchups[i];
          const teamAId = m.seedA !== null ? (slots[m.seedA]?.teamId || null) : null;
          const teamBId = m.seedB !== null ? (slots[m.seedB]?.teamId || null) : null;
          roundGames.push({
            tournamentId: t.id,
            roundNumber,
            matchNumber: i + 1,
            roundName: rd.roundName,
            teamAId,
            teamBId,
            status: "scheduled",
          });
        }
        const inserted = await db.insert(games).values(roundGames).returning();
        insertedByRound.set(rd.roundName, inserted);
        roundNumber++;
      }

      const firstRound = rounds[0].roundName;
      const hasWildcards = firstRound === "Wildcard";
      const hasRo16 = firstRound === "Round of 16";
      const hasFirstRound = firstRound === "First Round";

      if (hasFirstRound && numTeams === 6) {
        const frGames = insertedByRound.get("First Round") || [];
        const sfGames = insertedByRound.get("Semifinal") || [];
        if (frGames[0] && sfGames[0]) {
          await db.update(games).set({ nextGameId: sfGames[0].id, nextGameSlot: "B" }).where(eq(games.id, frGames[0].id));
        }
        if (frGames[1] && sfGames[1]) {
          await db.update(games).set({ nextGameId: sfGames[1].id, nextGameSlot: "B" }).where(eq(games.id, frGames[1].id));
        }
        const champGames = insertedByRound.get("Championship") || [];
        for (let i = 0; i < sfGames.length; i++) {
          await db.update(games).set({ nextGameId: champGames[0].id, nextGameSlot: i === 0 ? "A" : "B" }).where(eq(games.id, sfGames[i].id));
        }
      } else if (hasWildcards) {
        const wcGames = insertedByRound.get("Wildcard") || [];
        const qfGames = insertedByRound.get("Quarterfinal") || [];

        if (numTeams === 10) {
          if (wcGames[0] && qfGames[0]) await db.update(games).set({ nextGameId: qfGames[0].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[0].id));
          if (wcGames[1] && qfGames[3]) await db.update(games).set({ nextGameId: qfGames[3].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[1].id));
        } else if (numTeams === 12) {
          if (wcGames[0] && qfGames[0]) await db.update(games).set({ nextGameId: qfGames[0].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[0].id));
          if (wcGames[1] && qfGames[1]) await db.update(games).set({ nextGameId: qfGames[1].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[1].id));
          if (wcGames[2] && qfGames[2]) await db.update(games).set({ nextGameId: qfGames[2].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[2].id));
          if (wcGames[3] && qfGames[3]) await db.update(games).set({ nextGameId: qfGames[3].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[3].id));
        } else if (numTeams === 14) {
          if (wcGames[0] && qfGames[0]) await db.update(games).set({ nextGameId: qfGames[0].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[0].id));
          if (wcGames[1] && qfGames[1]) await db.update(games).set({ nextGameId: qfGames[1].id, nextGameSlot: "A" }).where(eq(games.id, wcGames[1].id));
          if (wcGames[2] && qfGames[1]) await db.update(games).set({ nextGameId: qfGames[1].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[2].id));
          if (wcGames[3] && qfGames[2]) await db.update(games).set({ nextGameId: qfGames[2].id, nextGameSlot: "A" }).where(eq(games.id, wcGames[3].id));
          if (wcGames[4] && qfGames[2]) await db.update(games).set({ nextGameId: qfGames[2].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[4].id));
          if (wcGames[5] && qfGames[3]) await db.update(games).set({ nextGameId: qfGames[3].id, nextGameSlot: "B" }).where(eq(games.id, wcGames[5].id));
        } else {
          const qfWithEmptySlots = qfGames.filter(g => !g.teamBId);
          for (let wi = 0; wi < wcGames.length; wi++) {
            const qfGame = qfWithEmptySlots[wi];
            if (qfGame) {
              await db.update(games).set({ nextGameId: qfGame.id, nextGameSlot: "B" }).where(eq(games.id, wcGames[wi].id));
            }
          }
        }

        const sfGames = insertedByRound.get("Semifinal") || [];
        for (let qi = 0; qi < qfGames.length; qi++) {
          const sfIdx = Math.floor(qi / 2);
          const slot = qi % 2 === 0 ? "A" : "B";
          if (sfIdx < sfGames.length) {
            await db.update(games).set({ nextGameId: sfGames[sfIdx].id, nextGameSlot: slot }).where(eq(games.id, qfGames[qi].id));
          }
        }
        const champGames = insertedByRound.get("Championship") || [];
        for (let si = 0; si < sfGames.length; si++) {
          await db.update(games).set({ nextGameId: champGames[0].id, nextGameSlot: si === 0 ? "A" : "B" }).where(eq(games.id, sfGames[si].id));
        }
      } else if (hasRo16) {
        const ro16Games = insertedByRound.get("Round of 16") || [];
        const qfGames = insertedByRound.get("Quarterfinal") || [];
        for (let i = 0; i < ro16Games.length; i++) {
          const qfIdx = Math.floor(i / 2);
          const slot = i % 2 === 0 ? "A" : "B";
          await db.update(games).set({ nextGameId: qfGames[qfIdx].id, nextGameSlot: slot }).where(eq(games.id, ro16Games[i].id));
        }
        const sfGames = insertedByRound.get("Semifinal") || [];
        for (let qi = 0; qi < qfGames.length; qi++) {
          const sfIdx = Math.floor(qi / 2);
          const slot = qi % 2 === 0 ? "A" : "B";
          await db.update(games).set({ nextGameId: sfGames[sfIdx].id, nextGameSlot: slot }).where(eq(games.id, qfGames[qi].id));
        }
        const champGames = insertedByRound.get("Championship") || [];
        for (let si = 0; si < sfGames.length; si++) {
          await db.update(games).set({ nextGameId: champGames[0].id, nextGameSlot: si === 0 ? "A" : "B" }).where(eq(games.id, sfGames[si].id));
        }
      } else {
        const roundNames = rounds.map(r => r.roundName);
        for (let ri = 0; ri < roundNames.length - 1; ri++) {
          const currentGames = insertedByRound.get(roundNames[ri]) || [];
          const nextGames = insertedByRound.get(roundNames[ri + 1]) || [];
          for (let gi = 0; gi < currentGames.length; gi++) {
            const nextIdx = Math.floor(gi / 2);
            const slot = gi % 2 === 0 ? "A" : "B";
            if (nextIdx < nextGames.length) {
              await db.update(games).set({ nextGameId: nextGames[nextIdx].id, nextGameSlot: slot }).where(eq(games.id, currentGames[gi].id));
            }
          }
        }
      }

      const totalGames = Array.from(insertedByRound.values()).reduce((s, arr) => s + arr.length, 0);
      await createAuditLog("bracket_created", req.session.userId!, "tournament", t.id, { numTeams, gamesCreated: totalGames });

      await db.insert(activityEvents).values({
        type: "schedule",
        title: "Bracket Released",
        description: `The elimination bracket for ${t.name} has been set with ${numTeams} teams.`,
        tournamentId: t.id,
      });

      res.json({ success: true, gamesCreated: totalGames });
    } catch (err) {
      console.error("Error creating bracket:", err);
      res.status(500).json({ error: "Failed to create bracket" });
    }
  });

  // ─── AUDIT LOGS ─────────────────────────────────────
  app.get("/api/audit-logs", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ─── ADMIN ACCOUNTS ────────────────────────────────
  app.get("/api/admin/accounts", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        teamId: users.teamId,
        playerId: users.playerId,
        playerLinkApproved: users.playerLinkApproved,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.put("/api/admin/accounts/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { role, teamId, playerId } = req.body;
      const updateData: any = {};
      if (role !== undefined) updateData.role = role;
      if (teamId !== undefined) updateData.teamId = teamId || null;
      if (playerId !== undefined) updateData.playerId = playerId || null;
      const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "User not found" });
      const { password: _, ...userWithoutPw } = updated;
      res.json(userWithoutPw);
    } catch (err) {
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.put("/api/admin/accounts/:id/reset-password", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const hashed = await hashPassword(newPassword);
      const [updated] = await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "User not found" });
      await createAuditLog("password_reset", req.session.userId!, "user", req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.delete("/api/admin/accounts/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.role === "admin") return res.status(400).json({ error: "Cannot delete admin accounts" });
      await db.delete(users).where(eq(users.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // ─── ADMIN STATS ────────────────────────────────────
  app.get("/api/admin/stats", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const [teamCount] = await db.select({ count: sql<number>`count(*)` }).from(teams);
      const [playerCount] = await db.select({ count: sql<number>`count(*)` }).from(players);
      const [tournamentCount] = await db.select({ count: sql<number>`count(*)` }).from(tournaments);
      const [gameCount] = await db.select({ count: sql<number>`count(*)` }).from(games);
      const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);

      const teamsByRegion = await db.select({
        region: teams.region,
        count: sql<number>`count(*)`,
      }).from(teams).groupBy(teams.region);

      const tournamentsByStatus = await db.select({
        status: tournaments.status,
        count: sql<number>`count(*)`,
      }).from(tournaments).groupBy(tournaments.status);

      res.json({
        totalTeams: Number(teamCount?.count || 0),
        totalPlayers: Number(playerCount?.count || 0),
        totalTournaments: Number(tournamentCount?.count || 0),
        totalGames: Number(gameCount?.count || 0),
        totalOrders: Number(orderCount?.count || 0),
        teamsByRegion,
        tournamentsByStatus,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // ─── GAME PLAYER STATS ─────────────────────────────
  app.get("/api/games/:id/player-stats", async (req: Request, res: Response) => {
    try {
      const stats = await db.select().from(gamePlayerStats)
        .where(eq(gamePlayerStats.gameId, req.params.id));
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch game player stats" });
    }
  });

  app.post("/api/games/:id/player-stats", requireRole("admin", "referee"), async (req: Request, res: Response) => {
    try {
      const [game] = await db.select().from(games).where(eq(games.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (game.status !== "final" && game.status !== "locked") {
        return res.status(400).json({ error: "Game must be finalized before entering stats" });
      }

      const { stats: playerStatsArray } = req.body;
      if (!Array.isArray(playerStatsArray)) {
        return res.status(400).json({ error: "stats must be an array" });
      }

      await db.delete(gamePlayerStats).where(eq(gamePlayerStats.gameId, req.params.id));

      const inserted = [];
      for (const stat of playerStatsArray) {
        if (!stat.playerId || !stat.teamId) continue;
        const hasStat = stat.touchdowns || stat.interceptions || stat.isMvp;
        if (!hasStat) continue;

        const [row] = await db.insert(gamePlayerStats).values({
          gameId: req.params.id,
          playerId: stat.playerId,
          teamId: stat.teamId,
          touchdowns: stat.touchdowns || 0,
          interceptions: stat.interceptions || 0,
          isMvp: stat.isMvp || false,
        }).returning();
        inserted.push(row);
      }

      const allPlayers = await db.select().from(players)
        .where(
          or(
            eq(players.teamId, game.teamAId!),
            eq(players.teamId, game.teamBId!)
          )
        );

      for (const player of allPlayers) {
        const allGameStats = await db.select().from(gamePlayerStats)
          .where(eq(gamePlayerStats.playerId, player.id));

        const totals = allGameStats.reduce((acc, gs) => ({
          touchdowns: acc.touchdowns + gs.touchdowns,
          interceptions: acc.interceptions + gs.interceptions,
          mvpAwards: acc.mvpAwards + (gs.isMvp ? 1 : 0),
        }), { touchdowns: 0, interceptions: 0, mvpAwards: 0 });

        const gamesPlayedResult = await db.select({ count: sql<number>`count(DISTINCT game_id)` })
          .from(gamePlayerStats).where(eq(gamePlayerStats.playerId, player.id));

        const playerGameIds = allGameStats.map(gs => gs.gameId);
        let playerWins = 0;
        if (playerGameIds.length > 0) {
          const playerGames = await db.select().from(games).where(inArray(games.id, playerGameIds));
          playerWins = playerGames.filter(g => g.winnerId === player.teamId).length;
        }

        await db.update(players).set({
          ...totals,
          gamesPlayed: Number(gamesPlayedResult[0]?.count || 0),
          wins: playerWins,
          updatedAt: new Date(),
        }).where(eq(players.id, player.id));
      }

      await createAuditLog("player_stats_entered", req.session.userId!, "game", req.params.id, { statsCount: inserted.length });

      const [teamAInfo] = game.teamAId ? await db.select().from(teams).where(eq(teams.id, game.teamAId)) : [null as any];
      const [teamBInfo] = game.teamBId ? await db.select().from(teams).where(eq(teams.id, game.teamBId)) : [null as any];

      const notifiedForStats = new Set<string>();
      for (const stat of inserted) {
        const [player] = await db.select().from(players).where(eq(players.id, stat.playerId));
        if (!player) continue;
        const opponentName = player.teamId === game.teamAId
          ? (teamBInfo?.name || "opponent")
          : (teamAInfo?.name || "opponent");
        const statParts: string[] = [];
        if (stat.touchdowns > 0) statParts.push(`${stat.touchdowns} TD${stat.touchdowns > 1 ? "s" : ""}`);
        if (stat.interceptions > 0) statParts.push(`${stat.interceptions} INT${stat.interceptions > 1 ? "s" : ""}`);
        if (stat.isMvp) statParts.push("Game MVP");
        if (statParts.length > 0) {
          await notifyFollowers("player", player.id, "player_stats",
            `${player.name} Stats Update`,
            `${player.name} ${statParts.join(", ")} vs ${opponentName}`,
            game.id, "game", notifiedForStats);
        }
      }

      res.json({ message: "Stats saved", count: inserted.length, stats: inserted });
    } catch (err) {
      console.error("Save player stats error:", err);
      res.status(500).json({ error: "Failed to save player stats" });
    }
  });

  // ─── VIDEO UPLOADS ──────────────────────────────────
  const uploadsDir = path.join(process.cwd(), "uploads", "highlights");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(mp4|mov|avi|webm|m4v)$/i;
      if (allowed.test(path.extname(file.originalname))) {
        cb(null, true);
      } else {
        cb(new Error("Only video files are allowed"));
      }
    },
  });

  app.use("/uploads", (await import("express")).default.static(path.join(process.cwd(), "uploads")));

  app.post("/api/upload/video", requireAuth, upload.single("video"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No video file provided" });
      const videoUrl = `/uploads/highlights/${req.file.filename}`;
      res.json({ url: videoUrl });
    } catch (err) {
      console.error("Video upload error:", err);
      res.status(500).json({ error: "Failed to upload video" });
    }
  });

  // ─── PLAYER HIGHLIGHTS ────────────────────────────────
  app.get("/api/players/:id/highlights", async (req: Request, res: Response) => {
    try {
      const highlights = await db.select().from(playerHighlights)
        .where(eq(playerHighlights.playerId, req.params.id))
        .orderBy(desc(playerHighlights.createdAt));
      res.json(highlights);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch highlights" });
    }
  });

  app.post("/api/players/:id/highlights", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId!));
      if (!user.length) return res.status(401).json({ error: "Not authenticated" });
      const isAdmin = user[0].role === "admin";
      const isOwner = user[0].playerId === req.params.id;
      if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized" });

      const { videoUrl, thumbnailUrl, caption, gameId } = req.body;
      if (!videoUrl) return res.status(400).json({ error: "Video URL is required" });

      const existingCount = await db.select({ count: sql<number>`count(*)` })
        .from(playerHighlights).where(eq(playerHighlights.playerId, req.params.id));

      const [highlight] = await db.insert(playerHighlights).values({
        playerId: req.params.id,
        videoUrl,
        thumbnailUrl: thumbnailUrl || null,
        caption: caption || null,
        gameId: gameId || null,
        sortOrder: Number(existingCount[0]?.count || 0),
      }).returning();

      res.status(201).json(highlight);
    } catch (err) {
      console.error("Create highlight error:", err);
      res.status(500).json({ error: "Failed to create highlight" });
    }
  });

  app.delete("/api/players/:id/highlights/:highlightId", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId!));
      if (!user.length) return res.status(401).json({ error: "Not authenticated" });
      const isAdmin = user[0].role === "admin";
      const isOwner = user[0].playerId === req.params.id;
      if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized" });

      await db.delete(playerHighlights).where(eq(playerHighlights.id, req.params.highlightId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete highlight" });
    }
  });

  // ─── PLAYER EXTERNAL LINKS ───────────────────────────
  app.get("/api/players/:id/external-links", async (req: Request, res: Response) => {
    try {
      const links = await db.select().from(playerExternalLinks)
        .where(eq(playerExternalLinks.playerId, req.params.id))
        .orderBy(playerExternalLinks.createdAt);
      const platformOrder: Record<string, number> = { hudl: 0, twitter: 1, instagram: 2 };
      const sorted = [...links].sort((a, b) => {
        const aOrder = platformOrder[a.platform.toLowerCase()] ?? 99;
        const bOrder = platformOrder[b.platform.toLowerCase()] ?? 99;
        return aOrder - bOrder;
      });
      res.json(sorted);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch external links" });
    }
  });

  app.post("/api/players/:id/external-links", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId!));
      if (!user.length) return res.status(401).json({ error: "Not authenticated" });
      const isAdmin = user[0].role === "admin";
      const isOwner = user[0].playerId === req.params.id;
      if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized" });

      const { platform, url: rawUrl, label } = req.body;
      if (!platform || !rawUrl) return res.status(400).json({ error: "Platform and URL are required" });

      let url = rawUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;

      const og = await fetchOGMetadata(url);

      const [link] = await db.insert(playerExternalLinks).values({
        playerId: req.params.id,
        platform,
        url,
        label: label || null,
        ogTitle: og.ogTitle || null,
        ogDescription: og.ogDescription || null,
        ogImage: og.ogImage || null,
      }).returning();

      res.status(201).json(link);
    } catch (err) {
      console.error("Create external link error:", err);
      res.status(500).json({ error: "Failed to create external link" });
    }
  });

  app.put("/api/players/:id/external-links/:linkId", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId!));
      if (!user.length) return res.status(401).json({ error: "Not authenticated" });
      const isAdmin = user[0].role === "admin";
      const isOwner = user[0].playerId === req.params.id;
      if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized" });

      const { platform, url: rawUrl, label } = req.body;
      if (!platform || !rawUrl) return res.status(400).json({ error: "Platform and URL are required" });

      let url = rawUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;

      const og = await fetchOGMetadata(url);

      const [updated] = await db.update(playerExternalLinks)
        .set({
          platform,
          url,
          label: label || null,
          ogTitle: og.ogTitle || null,
          ogDescription: og.ogDescription || null,
          ogImage: og.ogImage || null,
        })
        .where(eq(playerExternalLinks.id, req.params.linkId))
        .returning();

      if (!updated) return res.status(404).json({ error: "Link not found" });
      res.json(updated);
    } catch (err) {
      console.error("Update external link error:", err);
      res.status(500).json({ error: "Failed to update external link" });
    }
  });

  app.delete("/api/players/:id/external-links/:linkId", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId!));
      if (!user.length) return res.status(401).json({ error: "Not authenticated" });
      const isAdmin = user[0].role === "admin";
      const isOwner = user[0].playerId === req.params.id;
      if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized" });

      await db.delete(playerExternalLinks).where(eq(playerExternalLinks.id, req.params.linkId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete external link" });
    }
  });

  // ─── PLAYER RECRUITING PROFILE ────────────────────────
  app.get("/api/players/:id/recruiting", async (req: Request, res: Response) => {
    try {
      const [profile] = await db.select().from(playerRecruitingProfiles)
        .where(eq(playerRecruitingProfiles.playerId, req.params.id));
      res.json(profile || null);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch recruiting profile" });
    }
  });

  app.put("/api/players/:id/recruiting", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId!));
      if (!user.length) return res.status(401).json({ error: "Not authenticated" });
      const isAdmin = user[0].role === "admin";
      const isOwner = user[0].playerId === req.params.id;
      if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized" });

      const { gradYear, primaryPosition, heightInches, weightLbs, school, contactEmail, showContactEmail, bio } = req.body;

      const existing = await db.select().from(playerRecruitingProfiles)
        .where(eq(playerRecruitingProfiles.playerId, req.params.id));

      if (existing.length > 0) {
        const [updated] = await db.update(playerRecruitingProfiles).set({
          gradYear: gradYear ?? existing[0].gradYear,
          primaryPosition: primaryPosition ?? existing[0].primaryPosition,
          heightInches: heightInches ?? existing[0].heightInches,
          weightLbs: weightLbs ?? existing[0].weightLbs,
          school: school ?? existing[0].school,
          contactEmail: contactEmail ?? existing[0].contactEmail,
          showContactEmail: showContactEmail ?? existing[0].showContactEmail,
          bio: bio ?? existing[0].bio,
          updatedAt: new Date(),
        }).where(eq(playerRecruitingProfiles.playerId, req.params.id)).returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(playerRecruitingProfiles).values({
          playerId: req.params.id,
          gradYear: gradYear || null,
          primaryPosition: primaryPosition || null,
          heightInches: heightInches || null,
          weightLbs: weightLbs || null,
          school: school || null,
          contactEmail: contactEmail || null,
          showContactEmail: showContactEmail || false,
          bio: bio || null,
        }).returning();
        res.status(201).json(created);
      }
    } catch (err) {
      console.error("Update recruiting profile error:", err);
      res.status(500).json({ error: "Failed to update recruiting profile" });
    }
  });

  // ─── PLAYER BADGES ────────────────────────────────────
  app.get("/api/players/:id/badges", async (req: Request, res: Response) => {
    try {
      const badges = await db.select().from(playerBadges)
        .where(eq(playerBadges.playerId, req.params.id))
        .orderBy(desc(playerBadges.createdAt));
      res.json(badges);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  app.post("/api/admin/players/:id/badges", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { badgeType, note } = req.body;
      if (!["black", "gold", "silver"].includes(badgeType)) {
        return res.status(400).json({ error: "Invalid badge type" });
      }
      const [player] = await db.select().from(players).where(eq(players.id, req.params.id));
      if (!player) return res.status(404).json({ error: "Player not found" });
      const [badge] = await db.insert(playerBadges).values({
        playerId: req.params.id,
        badgeType,
        note: note || null,
        awardedBy: (req as any).session?.userId || null,
      }).returning();
      await notifyFollowers("player", req.params.id, "badge_awarded",
        `${player.name} earned a MECA Badge!`,
        `${player.name} was awarded a ${badgeType.charAt(0).toUpperCase() + badgeType.slice(1)} MECA Badge.`,
        badge.id, "badge");
      res.status(201).json(badge);
    } catch (err) {
      res.status(500).json({ error: "Failed to award badge" });
    }
  });

  app.delete("/api/admin/badges/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const [badge] = await db.select().from(playerBadges).where(eq(playerBadges.id, req.params.id));
      if (!badge) return res.status(404).json({ error: "Badge not found" });
      await db.delete(playerBadges).where(eq(playerBadges.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove badge" });
    }
  });

  app.get("/api/badges/:id/card", async (req: Request, res: Response) => {
    try {
      const [badge] = await db.select().from(playerBadges).where(eq(playerBadges.id, req.params.id));
      if (!badge) return res.status(404).send("Badge not found");
      const [player] = await db.select().from(players).where(eq(players.id, badge.playerId));
      if (!player) return res.status(404).send("Player not found");
      const [team] = player.teamId
        ? await db.select().from(teams).where(eq(teams.id, player.teamId))
        : [null];
      const tierColors: Record<string, { bg: string; accent: string; label: string }> = {
        black: { bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", accent: "#C0C0C0", label: "BLACK" },
        gold:  { bg: "linear-gradient(135deg, #1a1200 0%, #2d2000 50%, #3d2c00 100%)", accent: "#FFD93D", label: "GOLD" },
        silver:{ bg: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)", accent: "#C0C0C0", label: "SILVER" },
      };
      const tier = tierColors[badge.badgeType] || tierColors.silver;
      const initials = player.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="${player.name} MECA Card">
  <title>${player.name} — MECA ${tier.label} Card</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0E1A; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, sans-serif; padding: 24px; }
    .card { width: 320px; border-radius: 24px; padding: 32px 24px; background: ${tier.bg}; border: 1.5px solid ${tier.accent}40; box-shadow: 0 0 60px ${tier.accent}30, 0 20px 60px rgba(0,0,0,0.8); position: relative; overflow: hidden; }
    .card::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, ${tier.accent}08 0%, transparent 60%); pointer-events: none; }
    .meca-logo { font-size: 11px; font-weight: 800; letter-spacing: 4px; color: ${tier.accent}; text-transform: uppercase; margin-bottom: 20px; opacity: 0.9; }
    .avatar { width: 80px; height: 80px; border-radius: 40px; background: ${tier.accent}20; border: 2px solid ${tier.accent}60; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: ${tier.accent}; margin: 0 auto 16px; }
    .player-name { font-size: 22px; font-weight: 800; color: #fff; text-align: center; margin-bottom: 6px; letter-spacing: 0.5px; }
    .team-name { font-size: 13px; color: ${tier.accent}99; text-align: center; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1.5px; }
    .badge-tier { display: inline-block; padding: 6px 18px; border-radius: 20px; background: ${tier.accent}20; border: 1px solid ${tier.accent}60; color: ${tier.accent}; font-size: 12px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin: 0 auto 20px; display: block; text-align: center; width: fit-content; margin-left: auto; margin-right: auto; }
    .divider { height: 1px; background: ${tier.accent}20; margin: 16px 0; }
    .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 20px; }
    .stat { text-align: center; }
    .stat-value { font-size: 18px; font-weight: 800; color: #fff; }
    .stat-label { font-size: 9px; color: ${tier.accent}80; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .elo-row { display: flex; align-items: center; justify-content: space-between; }
    .elo-label { font-size: 10px; color: ${tier.accent}80; text-transform: uppercase; letter-spacing: 2px; }
    .elo-value { font-size: 18px; font-weight: 800; color: ${tier.accent}; }
    .card-id { font-size: 9px; color: ${tier.accent}40; letter-spacing: 1px; margin-top: 20px; text-align: center; }
    .wallet-note { margin-top: 24px; text-align: center; color: #8896B8; font-size: 13px; line-height: 1.6; max-width: 300px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="meca-logo">⬡ MECA 7v7</div>
    <div class="avatar">${initials}</div>
    <div class="player-name">${player.name}</div>
    <div class="team-name">${team?.name || "Free Agent"} · ${player.position}</div>
    <div class="badge-tier">◆ ${tier.label} BADGE</div>
    <div class="divider"></div>
    <div class="stats">
      <div class="stat"><div class="stat-value">${player.touchdowns}</div><div class="stat-label">TDs</div></div>
      <div class="stat"><div class="stat-value">${player.wins}</div><div class="stat-label">Wins</div></div>
      <div class="stat"><div class="stat-value">${player.mvpAwards}</div><div class="stat-label">MVPs</div></div>
    </div>
    <div class="elo-row">
      <div class="elo-label">ELO Rating</div>
      <div class="elo-value">${Math.round(player.elo)}</div>
    </div>
    <div class="card-id">MECA-${badge.id.slice(0, 8).toUpperCase()}</div>
  </div>
  <p class="wallet-note">Save this page to your Home Screen from Safari to keep your MECA Card handy.</p>
</body>
</html>`;
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err) {
      res.status(500).send("Failed to generate card");
    }
  });

  // ─── PUBLIC PLAYER PROFILE ────────────────────────────
  app.get("/api/players/:id/public-profile", async (req: Request, res: Response) => {
    try {
      const [player] = await db.select().from(players).where(eq(players.id, req.params.id));
      if (!player) return res.status(404).json({ error: "Player not found" });

      const [team] = player.teamId
        ? await db.select().from(teams).where(eq(teams.id, player.teamId))
        : [null];

      const highlights = await db.select().from(playerHighlights)
        .where(eq(playerHighlights.playerId, player.id))
        .orderBy(desc(playerHighlights.createdAt));

      const links = await db.select().from(playerExternalLinks)
        .where(eq(playerExternalLinks.playerId, player.id));
      const platformOrder: Record<string, number> = { hudl: 0, twitter: 1, instagram: 2 };
      const sortedLinks = [...links].sort((a, b) => {
        const aOrder = platformOrder[a.platform.toLowerCase()] ?? 99;
        const bOrder = platformOrder[b.platform.toLowerCase()] ?? 99;
        return aOrder - bOrder;
      });

      const [recruiting] = await db.select().from(playerRecruitingProfiles)
        .where(eq(playerRecruitingProfiles.playerId, player.id));

      const recruitingPublic = recruiting ? {
        ...recruiting,
        contactEmail: recruiting.showContactEmail ? recruiting.contactEmail : null,
      } : null;

      res.json({
        player,
        team: team || null,
        highlights,
        externalLinks: sortedLinks,
        recruiting: recruitingPublic,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch public profile" });
    }
  });

  // ─── ADMIN DASHBOARD HTML ───────────────────────────
  app.get("/admin", (_req: Request, res: Response) => {
    res.redirect("/admin/login");
  });

  app.get("/admin/*splat", (_req: Request, res: Response) => {
    res.sendFile("admin.html", { root: "./server/templates" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
