# Meca - 7v7 Football Tournament App

## Overview
Meca is a mobile application designed for a competitive 7v7 football tournament brand operating across the East Coast. Its primary purpose is to provide a comprehensive platform for tournament management, player/team statistics tracking, live bracket viewing, and fostering a competitive ecosystem within 7v7 football. The app supports multiple user roles including admins, referees, coaches, players, and spectators, aiming to enhance the overall tournament experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Mobile + Web)
- **Framework**: React Native with Expo SDK 54, utilizing Expo Router v6 for file-based routing and typed routes.
- **Navigation**: Tab-based layout (Home, Events, Rankings, Profile) with detail screens presented as card modals.
- **State Management**: TanStack React Query for server state; local React state for UI.
- **Styling**: React Native StyleSheet with custom color constants.
- **Fonts**: Google Fonts (Outfit family).
- **Platform Support**: iOS, Android, and Web (via react-native-web).

### Backend
- **Runtime**: Node.js with Express 5, written in TypeScript.
- **API**: RESTful API, with all routes under `/api`.
- **CORS**: Dynamic configuration for Replit dev domains and localhost.
- **Storage**: PostgreSQL via Drizzle ORM.
- **Production Hardening**: Includes response compression, rate limiting, connection pooling, graceful shutdown, and health checks.
- **In-memory Cache**: TTL-based cache for read-heavy endpoints, invalidated on writes.
- **Transaction Safety**: Uses `db.transaction()` for critical operations like game finalization to ensure data integrity.
- **Database Indexes**: 33 indexes for optimized lookups.
- **Authentication**: Session-based authentication using email as username, supporting guest mode. Auth screens are presented as modals.
- **Onboarding & Auth Gate**: WelcomeModal for first-time users and AuthGateModal for guests attempting restricted actions.
- **Claim System**: Allows players and coaches to claim profiles and teams, subject to admin approval.
- **ELO Engine**: Calculates rating changes upon game finalization.
- **Admin Dashboard**: Single-page HTML dashboard for unified tournament management.
- **Tournament Features**: Auto-generation of pool play schedules, bracket generation (2-16 teams with seeding), standings tiebreaker rules (Win% → Wins → Points For), and champion display.
- **Follow System**: Users can follow players, teams, and tournaments, triggering notifications.
- **Password Reset**: Token-based forgotten password flow.
- **Coach Management**: Coaches can claim multiple teams (requires admin approval) and manage team rosters and profiles.
- **Team External Links**: Supports adding external links to team profiles.
- **Rankings**: Filterable by age group.
- **Tournament Sibling Follow**: Following a tournament automatically follows its sibling tournaments across different age groups.
- **Game Detail Polling**: Dynamic polling of live game details.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Defined in `shared/schema.ts`, including tables for users, teams, players, tournaments, games, and more.
- **Schema Validation**: Uses drizzle-zod for Zod schema generation from Drizzle definitions.
- **Migrations**: Managed via `drizzle-kit`.
- **Age Group System**: Tournaments and teams are categorized by age group, with specific handling for multi-age-group events and rankings filtering.
- **Seed Data**: `server/seed.ts` provides comprehensive initial data for development and testing.

### Data Flow
- All mobile app screens consume real API data through React Query hooks (`lib/api-hooks.ts`).
- Data transformation functions map backend data to frontend types defined in `lib/types.ts`.
- `shared/` directory contains schema shared between frontend and backend.

### Key Design Decisions
- **Monorepo Structure**: Frontend and backend co-exist in one repository with shared types/schema.
- **Interface-based Storage**: Allowed flexible swapping of storage implementations.
- **File-based Routing**: Utilizes Expo Router for simplified navigation.

## External Dependencies

### Core Services
- **PostgreSQL**: Primary database, configured via `DATABASE_URL`.
- **Replit**: Hosting platform, leveraging Replit-specific environment variables for deployment and development.

### Key npm Packages
- `expo`: Core mobile framework.
- `expo-router`: File-based routing for Expo.
- `express`: Backend HTTP server.
- `drizzle-orm` & `drizzle-kit`: ORM and migration tools for PostgreSQL.
- `@tanstack/react-query`: Asynchronous state management.
- `pg`: PostgreSQL client.
- `zod` & `drizzle-zod`: Schema validation.

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string.
- `EXPO_PUBLIC_DOMAIN`: Public domain for frontend API calls.
- `REPLIT_DEV_DOMAIN`: Replit development domain.
- `REPLIT_DOMAINS`: Comma-separated list of Replit domains for CORS.