# Forge — Session Log

---

## Day 1 — 2026-04-09

**Goal:** Project setup — scaffold, configure, verify launch

**Tasks completed:**
- [x] Task 1 — Manually scaffolded electron-vite + React + TypeScript project (CLI was TTY-interactive, scaffolded by hand)
- [x] Task 2 — Configured Tailwind CSS v3 with dark theme CSS variables + postcss
- [x] Task 3 — Set up better-sqlite3 v12 + Drizzle ORM with full schema (projects, phases, phase_logs, model_usage, sessions)
- [x] Task 4 — `npm run build` passes cleanly (3 bundles: main, preload, renderer)
- [x] Task 5 — Git initialized, initial commit ready, awaiting GitHub push

**Issues encountered:**
- `better-sqlite3` v9.6.0 incompatible with Electron 33 (V8 C++20 API changes). Fixed by upgrading to v12.8.0 + electron-rebuild.
- `create-electron-vite` CLI is TTY-only — scaffolded all files manually instead.

**Summary:**
Foundation is solid. All configs written, Drizzle schema complete with all 5 tables, Tailwind wired with design tokens, build passes with no errors. Day 2 can start directly on Layout + Router.

**Day 1 — Hardening pass (post-review):**
Visualized the Day 1 graph with `code-review-graph` and applied targeted fixes:
- `db/client.ts` — DB path now derived from caller (`app.getPath('userData')`) instead of hardcoded macOS dir; properly typed as `BetterSQLite3Database<typeof schema>`; migration step uses `existsSync` so real migration errors no longer get swallowed; added `closeDb()` for graceful shutdown.
- `main/index.ts` — passes Electron's `userData` path into `initDb`, surfaces DB init failures via `dialog.showErrorBox` + `app.exit(1)` instead of silently continuing, and closes the DB on `before-quit`.
- `preload/index.ts` + new `preload/index.d.ts` — typed `window.api` / `window.electron` via a `ForgeApi` interface so renderer code gets autocomplete on the IPC bridge from Day 2 onward.
- `drizzle.config.ts` — replaced macOS-only path with cross-platform default (`./.local/forge-dev.db`), overridable via `FORGE_DB_URL`.
- `.gitignore` — excludes per-machine tool artifacts (`.code-review-graph/`, MCP/agent configs) and the local dev DB dir.
- `npm run build` still passes cleanly (main + preload + renderer bundles).

---

## Day 2 — 2026-04-10

**Goal:** Build main layout + routing so all 4 pages are navigable

**Tasks completed:**
- [x] Task 1 — Built `Layout.tsx` — root wrapper composing Sidebar + Header + Outlet
- [x] Task 2 — Built `Sidebar.tsx` — left nav with NavLinks (Home, Settings, Models), active highlighting, drag region, project list placeholder
- [x] Task 3 — Built `Header.tsx` — page title from route + model cost indicator stub
- [x] Task 4 — Built page stubs: `Home.tsx` (project list + New Project), `Project.tsx` (prompt textarea), `Settings.tsx` (API key fields), `Models.tsx` (usage cards)
- [x] Task 5 — Wired HashRouter in `App.tsx` — `/`, `/project/:id`, `/settings`, `/models` all render under Layout
- [x] Task 6 — Build passes cleanly, 3 commits pushed to GitHub

**Summary:**
Layout shell and routing are complete. All 4 pages navigable without crash. Sidebar highlights active route, Header shows contextual page title. Pages have appropriate empty/placeholder states ready for Day 3 (Settings + keytar) and Day 4 (project CRUD).
