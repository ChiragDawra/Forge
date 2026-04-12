# Forge — Day 4 Session Log

**Date:** 2026-04-12
**Goal:** Database migrations + Project CRUD (create, list, get)
**Duration:** ~2 hrs

---

## Completed

- [x] Generated Drizzle migrations (`drizzle-kit generate` → `0000_round_sphinx.sql`)
- [x] Created `src/main/ipc/projects.ts` — IPC handlers:
  - `projects:create` — insert project with UUID, name, prompt, timestamps
  - `projects:list` — fetch all projects ordered by creation date (desc)
  - `projects:get` — fetch single project by ID
  - Input validation (non-empty strings, max length limits)
- [x] Registered project IPC handlers in `src/main/index.ts`
- [x] Updated preload bridge — `window.api.projects.{create, list, get}`
- [x] Updated type definitions — `ProjectRow` interface, `ForgeApi.projects`
- [x] Created Zustand store (`src/renderer/src/lib/stores/projects.ts`)
  - Shared state between Home, Sidebar, and Project pages
  - `fetch()`, `createProject()` actions
  - Electron detection guard
- [x] Wired `Home.tsx` — loads project list, shows cards with status + date
- [x] Wired `Project.tsx`:
  - `/project/new` — name + prompt form → creates project → navigates to detail view
  - `/project/:id` — loads and displays project name, status, prompt, placeholder for phases
- [x] Wired `Sidebar.tsx` — live project list with NavLink routing
- [x] Build + TypeScript typecheck pass cleanly

## Architecture Decisions

- **Zustand store** for projects — shared across Home, Sidebar, Project pages; auto-refetches on create
- **UUID primary keys** — generated server-side via `crypto.randomUUID()`
- **Input validation in IPC** — name max 200 chars, prompt max 10,000 chars
- **`toProjectRow()` serializer** — converts Drizzle Date objects to epoch ms for safe IPC transfer

## Files Changed

| File | Action |
|------|--------|
| `src/main/db/migrations/0000_round_sphinx.sql` | Created (generated) |
| `src/main/db/migrations/meta/` | Created (generated) |
| `src/main/ipc/projects.ts` | Created |
| `src/main/index.ts` | Modified — register projects IPC |
| `src/preload/index.ts` | Modified — projects bridge |
| `src/preload/index.d.ts` | Modified — ProjectRow + projects types |
| `src/renderer/src/lib/stores/projects.ts` | Created |
| `src/renderer/src/pages/Home.tsx` | Modified — live project list |
| `src/renderer/src/pages/Project.tsx` | Modified — create + detail views |
| `src/renderer/src/components/layout/Sidebar.tsx` | Modified — live project list |

## Next (Day 5)

- Wire AI API clients (Anthropic + Gemini) using stored API keys
- Test actual API calls from Electron
