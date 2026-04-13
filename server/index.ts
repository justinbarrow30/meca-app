import express from "express";
import type { Request, Response, NextFunction } from "express";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { pool } from "./db";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const app = express();
const log = console.log;
const isProduction = process.env.NODE_ENV === "production";
const BUILD_TIME = new Date().toISOString();

let gitCommit = "unknown";
try { gitCommit = execSync("git rev-parse --short HEAD 2>/dev/null").toString().trim() || "unknown"; } catch { /* ignore */ }

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  let landingPageTemplate: string;
  let appName: string;

  try {
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "landing-page.html",
    );
    landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
    appName = getAppName();
    log("Serving static Expo files with dynamic manifest routing");
  } catch (err) {
    log("Warning: Landing page template not found, / will serve health response");
    return;
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  log(`[boot] NODE_ENV=${process.env.NODE_ENV || "development"} commit=${gitCommit} time=${BUILD_TIME}`);

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/api/ready", async (_req: Request, res: Response) => {
    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      const dbLatency = Date.now() - start;
      const memUsage = process.memoryUsage();
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        commit: gitCommit,
        nodeEnv: process.env.NODE_ENV || "development",
        memory: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
        },
        db: {
          latencyMs: dbLatency,
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingClients: pool.waitingCount,
        },
      });
    } catch (err) {
      res.status(503).json({ status: "not_ready", error: "Database unreachable" });
    }
  });

  app.use(compression());

  app.set("trust proxy", 1);

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
    skip: (req) => !req.path.startsWith("/api"),
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again later" },
  });

  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/", apiLimiter);

  configureExpoAndLanding(app);

  app.get("/", (_req: Request, res: Response) => {
    res.status(200).type("text/plain").send("ok");
  });

  const server = await registerRoutes(app);

  pool.query(`
    CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
    CREATE INDEX IF NOT EXISTS idx_players_region ON players(region);
    CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo DESC);
    CREATE INDEX IF NOT EXISTS idx_games_tournament_id ON games(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_games_team_a_id ON games(team_a_id);
    CREATE INDEX IF NOT EXISTS idx_games_team_b_id ON games(team_b_id);
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    CREATE INDEX IF NOT EXISTS idx_games_field_id ON games(field_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_teams_team_id ON tournament_teams(team_id);
    CREATE INDEX IF NOT EXISTS idx_fields_tournament_id ON fields(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_game_player_stats_game_id ON game_player_stats(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_player_stats_player_id ON game_player_stats(player_id);
    CREATE INDEX IF NOT EXISTS idx_game_player_stats_team_id ON game_player_stats(team_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_follows_user_id ON follows(user_id);
    CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_tournament_id ON activity_events(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_player_highlights_player_id ON player_highlights(player_id);
    CREATE INDEX IF NOT EXISTS idx_player_external_links_player_id ON player_external_links(player_id);
    CREATE INDEX IF NOT EXISTS idx_player_recruiting_player_id ON player_recruiting_profiles(player_id);
    CREATE INDEX IF NOT EXISTS idx_team_external_links_team_id ON team_external_links(team_id);
    CREATE INDEX IF NOT EXISTS idx_coach_teams_user_id ON coach_teams(user_id);
    CREATE INDEX IF NOT EXISTS idx_coach_teams_team_id ON coach_teams(team_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_teams_elo ON teams(elo DESC);
    CREATE INDEX IF NOT EXISTS idx_teams_age_group ON teams(age_group);
    CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
    CREATE INDEX IF NOT EXISTS idx_tournaments_age_group ON tournaments(age_group);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  `).then(() => log("Database indexes ensured")).catch(err => console.error("Index creation error:", err));

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );

  const shutdown = () => {
    log("Shutting down gracefully...");
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });
    setTimeout(() => {
      log("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
