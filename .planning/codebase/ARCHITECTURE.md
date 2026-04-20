# Architecture

**Analysis Date:** 2026-04-20

## Pattern Overview

**Overall:** Electron desktop application with three-tier architecture — Main Process (backend), Preload (bridge), and Renderer (frontend).

**Key Characteristics:**
- Secure IPC-based main-renderer communication with context isolation and sandbox
- Task-based AI model routing (Gemini Flash for intake/deploy, Claude Base for planning/codegen/review/testing, Claude Opus for security)
- SQLite database with Drizzle ORM for local persistence
- React + React Router frontend with Zustand for state management
- Keychain-based credential storage for API keys

## Layers

**Main Process (Electron):**
- Purpose: Core application logic, database access, IPC handlers, AI integration, security enforcement
- Location: `src/main/`
- Contains: Database client/schema, IPC handlers (projects, settings, AI), AI model clients, initialization
- Depends on: Electron, Drizzle ORM, better-sqlite3, Anthropic SDK, Google Generative AI SDK
- Used by: Preload layer (via IPC), external processes (via Electron)

**Preload Layer:**
- Purpose: Secure bridge exposing a typed `ForgeApi` to renderer while maintaining security boundaries
- Location: `src/preload/`
- Contains: Context bridge with type definitions, IPC invoke wrappers
- Depends on: Electron (contextBridge, ipcRenderer), TypeScript types
- Used by: Renderer (via `window.api`)

**Renderer (React UI):**
- Purpose: User interface for managing projects, settings, and AI model usage
- Location: `src/renderer/src/`
- Contains: Pages, components, stores, utilities, styles
- Depends on: React, React Router, Zustand, Lucide icons, Tailwind CSS
- Used by: Users, accessed via Electron BrowserWindow

**Database:**
- Purpose: Persistent storage for projects, phases, logs, and AI model usage tracking
- Location: `src/main/db/`
- Contains: Schema definitions, client initialization, migrations
- Depends on: Drizzle ORM, better-sqlite3
- Used by: IPC handlers for data persistence and queries

**AI Routing & Integration:**
- Purpose: Model selection based on task type, API integration, cost calculation, usage logging
- Location: `src/main/ai/`
- Contains: Task router, model clients (Claude Base, Claude Opus, Gemini), types, initialization
- Depends on: External AI SDKs, database for usage logging
- Used by: IPC handlers (ai:call channel)

## Data Flow

**Project Creation Flow:**
1. User enters project name and prompt in Home page (`src/renderer/src/pages/Home.tsx`)
2. Frontend calls `window.api.projects.create(name, prompt)` (preload wrapper)
3. IPC routing: `projects:create` handler invoked in main process (`src/main/ipc/projects.ts`)
4. Security checks: sender validation, rate limiting, input sanitization
5. Database insert: new project record with UUID, timestamps, status='pending'
6. Return `ProjectRow` to renderer via IPC promise
7. Store updates via `useProjectsStore` (Zustand)

**AI Task Execution Flow:**
1. User submits task prompt in Project page
2. Frontend calls `window.api.ai.call(taskType, prompt, projectId, phaseId)`
3. IPC routing: `ai:call` handler in `src/main/ipc/ai.ts`
4. Task router (`src/main/ai/router.ts`) selects model based on task type:
   - 'intake' | 'deploy' → Gemini Flash
   - 'security' → Claude Opus
   - 'planning' | 'codegen' | 'review' | 'testing' | 'generic' → Claude Base
5. Model client executes API call, returns tokens + cost
6. Usage logged to `modelUsage` table with cost calculation
7. Response returned to renderer

**AI Credentials Flow:**
1. User enters API keys in Settings page (`src/renderer/src/pages/Settings.tsx`)
2. Frontend calls `window.api.settings.set(key, value)` for each key
3. IPC routing: `settings:set` handler in `src/main/ipc/settings.ts`
4. Value stored in system keychain via `keytar`
5. AI clients reinitialized non-blocking with new credentials
6. `initAiClients()` on startup loads keys from keychain, initializes SDK clients

**Usage Summary Flow:**
1. Models page queries usage data via `window.api.ai.usageSummary()` and `usageDaily(days)`
2. IPC handlers aggregate `modelUsage` table:
   - `usageSummary`: GROUP BY model_name, SUM tokens/cost, COUNT calls, MAX timestamp
   - `usageDaily`: Raw SQL to bin by date, GROUP BY date+model_name
3. Frontend displays charts and cards with formatted metrics

**State Management:**
- **Projects**: Zustand store (`src/renderer/src/lib/stores/projects.ts`) — projects array, loading, error state
- **UI State**: React local state (useState) in components for forms, filters, loading indicators
- **AI State**: No client-side state; all AI state persisted in database via IPC
- **Settings**: No client-side cache; fetched on demand from keychain

## Key Abstractions

**TaskType Router:**
- Purpose: Map task names to appropriate AI models
- Examples: `src/main/ai/router.ts`
- Pattern: Switch statement on TaskType enum, routes to typed model client functions
- Enables: Cost optimization (fast/cheap Gemini for intake, high-quality Claude Opus for security)

**ModelResponse:**
- Purpose: Uniform interface for all AI model responses
- Examples: `src/main/ai/types.ts`
- Pattern: Captures content, tokens (input/output), cost, model name
- Enables: Consistent logging, cost aggregation, model tracking

**IPC Handler Pattern:**
- Purpose: Secure, validated RPC endpoints between renderer and main
- Examples: `src/main/ipc/{projects,settings,ai}.ts`
- Pattern: `ipcMain.handle(channel, async handler)` with validation → security checks → business logic → audit log
- Enables: Rate limiting, input validation, error handling, audit trail

**Zustand Stores:**
- Purpose: Renderer-side state management with hooks
- Examples: `src/renderer/src/lib/stores/projects.ts`
- Pattern: `create<State>()` with actions (fetch, createProject)
- Enables: Reactive UI updates on data changes

**Format Utilities:**
- Purpose: Consistent display formatting across UI
- Examples: `src/renderer/src/lib/format.ts`
- Pattern: Pure functions for cost, tokens, time, model names/colors
- Enables: Centralized formatting rules, easy adjustment of display rules

## Entry Points

**Main Process Entry:**
- Location: `src/main/index.ts`
- Triggers: Electron app lifecycle (`app.whenReady()`)
- Responsibilities: 
  - Create BrowserWindow with security settings (sandbox, context isolation, CSP)
  - Initialize database and AI clients
  - Register IPC handlers (projects, settings, AI)
  - Install security headers and request handlers
  - Handle app lifecycle (window close, quit)

**Renderer Entry:**
- Location: `src/renderer/src/main.tsx`
- Triggers: Window load
- Responsibilities: Mount React app to DOM

**React App Root:**
- Location: `src/renderer/src/App.tsx`
- Triggers: React render
- Responsibilities: Define routes (Home, Project, Settings, Models) with Layout wrapper

**Preload Entry:**
- Location: `src/preload/index.ts`
- Triggers: Before renderer content loaded
- Responsibilities: Expose typed API object to renderer via context bridge

## Error Handling

**Strategy:** Fail-safe with user-facing error messages + audit logging

**Patterns:**
- **IPC Handlers:** Try-catch, validate all inputs (sender, rate limit, string constraints), catch and wrap errors with `safeErrorMessage()` to prevent leaking internal details
- **Database:** Initialize with error dialog on startup; connection errors logged; async failures log warning without crashing caller
- **AI Clients:** Non-blocking initialization on startup; missing keys are warnings; failed calls throw with safe message
- **Usage Logging:** Non-blocking; failures don't crash the AI call
- **Renderer:** Try-catch in async handlers, set error state for display, Zustand stores track error strings

## Cross-Cutting Concerns

**Logging:** Console logging with `[Module]` prefixes (e.g., `[Forge]`, `[DB]`, `[AI]`, `[AUDIT]`). Audit logs all IPC calls and errors.

**Validation:** 
- IPC: Sender origin check (file:// or localhost), rate limit (20 calls/sec per channel), string max lengths
- Database: UUIDs for IDs, timestamps for temporal data, foreign keys enabled
- Settings: Whitelist of valid keys (ANTHROPIC_BASE_KEY, ANTHROPIC_OPUS_KEY, GEMINI_API_KEY, VERCEL_TOKEN, GITHUB_TOKEN)

**Authentication:** Keychain-based credential storage via `keytar`. API keys stored per-OS-user (no plaintext in files).

**Security:** 
- Context isolation + sandbox in BrowserWindow
- CSP headers in production
- External link opens in default browser, never in app
- No navigation to external URLs allowed
- Block webview/iframe attachment
- Block permission requests (camera, microphone, geolocation)
- Input sanitization: reject control characters, enforce max lengths
- Error messages sanitized to prevent info leakage
- Rate limiting: 20 calls/sec per channel across all senders

---

*Architecture analysis: 2026-04-20*
