# Session Log — Day 20: Full Pipeline Integration Test

## Goal
Verify all 9 phases chain correctly end-to-end; fix integration bugs discovered during audit; establish a test baseline.

## Bugs Found & Fixed

### Bug 1: Inconsistent slug derivation (orchestrator vs. per-phase IPC)
**Where:** `src/main/ipc/orchestrator.ts` cases 4–8  
**Problem:** Used `projectId.slice(0,30).toLowerCase().replace(...)` as the scaffold slug, but `runScaffold` (case 3) derives slug from `architecture.projectName`. Any project whose name differs from its UUID prefix would have phases 4-8 pointing at a nonexistent directory.  
**Fix:** Added `deriveSlug(projectId, dir)` helper that reads `architecture.json` and uses `projectName` (same logic as `runScaffold`), falling back to projectId slice only if the file is missing.

### Bug 2: Deploy phase passing slug as project name
**Where:** `src/main/ipc/orchestrator.ts` case 8  
**Problem:** `runDeploy(projectId, deploySlug, deploySlug, ...)` — the 3rd arg (projectName for Vercel) was `deploySlug` (a kebab-case UUID fragment like `550e8400-e29b-41d4`).  
**Fix:** Query DB for `projects` row and use `row.name`; fall back to `deploySlug` only if DB query fails.

### Bug 3: Case 3 scaffold used projectId prefix as project name
**Where:** `src/main/ipc/orchestrator.ts` case 3  
**Problem:** `runScaffold(projectId.slice(0,30), ...)` generated a slug like `550e8400-e29b-41d4-a716` instead of the architecture's real project name.  
**Fix:** `runScaffold(architecture?.projectName ?? projectId.slice(0,30), ...)`.

## New: Vitest Integration Tests (23 tests, all pass)
**File:** `src/tests/integration/pipeline-state.test.ts`

### Test suites:
1. **`resumePhaseIndex`** (11 tests) — verifies each phase state returns the correct next index to run, including edge cases
2. **`slug derivation consistency`** (6 tests) — name-based slug, UUID fallback, truncation at 80 chars, special char replacement, idempotency
3. **`phase artefact filenames contract`** (6 tests) — documents the exact filenames each phase writes; if these drift from `project-state.ts` reads, resume breaks

## Build Infra
- Added `vitest` dev dependency
- Added `vitest.config.ts`  
- Added `npm test` and `npm run test:watch` scripts

## Build
`npm run build` — all 3 bundles pass  
`npm test` — 23/23 pass

## Commits
- `feat: pipeline integration — fix slug consistency, deploy name bug, add tests`
- `feat: Day 20 session log`
