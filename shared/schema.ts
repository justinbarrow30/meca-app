import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "referee",
  "coach",
  "player",
  "spectator",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "upcoming",
  "live",
  "completed",
  "cancelled",
]);

export const gameStatusEnum = pgEnum("game_status", [
  "scheduled",
  "live",
  "final",
  "locked",
  "cancelled",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "fulfilled",
  "refunded",
  "cancelled",
]);

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull().default(""),
  email: text("email"),
  name: text("name"),
  role: userRoleEnum("role").notNull().default("spectator"),
  teamId: varchar("team_id"),
  playerId: varchar("player_id"),
  playerLinkApproved: boolean("player_link_approved").notNull().default(false),
  region: text("region"),
  avatarUrl: text("avatar_url"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  abbreviation: varchar("abbreviation", { length: 6 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#4F6AF6"),
  secondaryColor: varchar("secondary_color", { length: 7 }).default("#F5E642"),
  logoInitials: varchar("logo_initials", { length: 4 }),
  region: text("region").default(""),
  ageGroup: varchar("age_group", { length: 4 }),
  elo: real("elo").notNull().default(1200),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  ties: integer("ties").notNull().default(0),
  coachId: varchar("coach_id"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  position: text("position").notNull(),
  number: integer("number").notNull(),
  teamId: varchar("team_id").notNull(),
  region: text("region").default(""),
  elo: real("elo").notNull().default(1200),
  touchdowns: integer("touchdowns").notNull().default(0),
  interceptions: integer("interceptions").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  mvpAwards: integer("mvp_awards").notNull().default(0),
  locked: boolean("locked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  region: text("region").default(""),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: tournamentStatusEnum("status").notNull().default("upcoming"),
  teamCount: integer("team_count").notNull().default(8),
  poolPlayGames: integer("pool_play_games").notNull().default(3),
  bracketFormat: jsonb("bracket_format"),
  ageGroup: text("age_group"),
  entryFee: real("entry_fee").default(0),
  prizePool: real("prize_pool").default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const divisions = pgTable("divisions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournamentTeams = pgTable("tournament_teams", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  teamId: varchar("team_id").notNull(),
  divisionId: varchar("division_id"),
  seed: integer("seed"),
  checkedIn: boolean("checked_in").notNull().default(false),
  rosterLocked: boolean("roster_locked").notNull().default(false),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
});

export const fields = pgTable("fields", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  name: text("name").notNull(),
  currentGameId: varchar("current_game_id"),
});

export const games = pgTable("games", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  divisionId: varchar("division_id"),
  roundNumber: integer("round_number").notNull().default(1),
  matchNumber: integer("match_number").notNull().default(1),
  roundName: text("round_name"),
  teamAId: varchar("team_a_id"),
  teamBId: varchar("team_b_id"),
  scoreA: integer("score_a"),
  scoreB: integer("score_b"),
  winnerId: varchar("winner_id"),
  status: gameStatusEnum("status").notNull().default("scheduled"),
  fieldId: varchar("field_id"),
  scheduledTime: timestamp("scheduled_time"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  nextGameId: varchar("next_game_id"),
  nextGameSlot: varchar("next_game_slot"),
  eloProcessed: boolean("elo_processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const gamePlayerStats = pgTable("game_player_stats", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull(),
  playerId: varchar("player_id").notNull(),
  teamId: varchar("team_id").notNull(),
  touchdowns: integer("touchdowns").notNull().default(0),
  interceptions: integer("interceptions").notNull().default(0),
  isMvp: boolean("is_mvp").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  tournamentId: varchar("tournament_id"),
  items: jsonb("items").notNull().default([]),
  total: real("total").notNull().default(0),
  status: orderStatusEnum("status").notNull().default("pending"),
  stripeSessionId: varchar("stripe_session_id"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  performedBy: varchar("performed_by").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityEvents = pgTable("activity_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tournamentId: varchar("tournament_id"),
  gameId: varchar("game_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerHighlights = pgTable("player_highlights", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  gameId: varchar("game_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playerExternalLinks = pgTable("player_external_links", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  label: text("label"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playerRecruitingProfiles = pgTable("player_recruiting_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull().unique(),
  gradYear: integer("grad_year"),
  primaryPosition: text("primary_position"),
  heightInches: integer("height_inches"),
  weightLbs: integer("weight_lbs"),
  school: text("school"),
  contactEmail: text("contact_email"),
  showContactEmail: boolean("show_contact_email").notNull().default(false),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"),
  relatedType: text("related_type"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamExternalLinks = pgTable("team_external_links", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const coachTeams = pgTable("coach_teams", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  teamId: varchar("team_id").notNull(),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerBadges = pgTable("player_badges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  badgeType: text("badge_type").notNull(),
  note: text("note"),
  awardedBy: varchar("awarded_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const follows = pgTable("follows", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
  role: true,
  teamId: true,
  region: true,
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  abbreviation: true,
  color: true,
  secondaryColor: true,
  logoInitials: true,
  region: true,
  coachId: true,
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  position: true,
  number: true,
  teamId: true,
  region: true,
  userId: true,
});

export const insertTournamentSchema = createInsertSchema(tournaments).pick({
  name: true,
  description: true,
  location: true,
  region: true,
  startDate: true,
  endDate: true,
  teamCount: true,
  poolPlayGames: true,
  entryFee: true,
  prizePool: true,
});

export const insertGameSchema = createInsertSchema(games).pick({
  tournamentId: true,
  divisionId: true,
  roundNumber: true,
  matchNumber: true,
  roundName: true,
  teamAId: true,
  teamBId: true,
  fieldId: true,
  scheduledTime: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type Division = typeof divisions.$inferSelect;
export type TournamentTeam = typeof tournamentTeams.$inferSelect;
export type Field = typeof fields.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type GamePlayerStat = typeof gamePlayerStats.$inferSelect;
export type PlayerHighlight = typeof playerHighlights.$inferSelect;
export type PlayerExternalLink = typeof playerExternalLinks.$inferSelect;
export type PlayerRecruitingProfile = typeof playerRecruitingProfiles.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TeamExternalLink = typeof teamExternalLinks.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type PlayerBadge = typeof playerBadges.$inferSelect;
