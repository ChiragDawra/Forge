# Forge — Day 5 Session Log

**Date:** 2026-04-17
**Goal:** AI client wrappers (Claude Base, Claude Opus, Gemini) with token tracking and cost logging
**Duration:** ~2 hrs

---

## Completed

### AI Clients (`src/main/ai/`)
- [x] `types.ts` — shared `ModelResponse`, `CallOptions`, `computeCost()`, `logUsage()`
- [x] `claude-base.ts` — Claude Sonnet (claude-sonnet-4-5) wrapper; writes to `model_usage` DB
- [x] `claude-opus.ts` — Claude Opus (claude-opus-4-6) wrapper; same pattern
- [x] `gemini.ts` — Gemini 2.0 Flash wrapper via `@google/generative-ai`; same pattern
- [x] `router.ts` — `routeTask(taskType)` maps tasks to optimal models:
  - `intake`, `deploy` → Gemini (fast + cheap)
  - `security` → Claude Opus (highest quality)
  - `planning`, `codegen`, `review`, `testing`, `generic` → Claude Base
- [x] `init.ts` — `initAiClients()` reads keys from OS keychain on startup; `reinitAiClients()` on key save

### IPC (`src/main/ipc/ai.ts`)
- [x] `ai:call` — calls `routeTask()`, returns `ModelResponse`
- [x] `ai:reinit` — reloads clients from keychain
- [x] `ai:usage-summary` — aggregated per-model usage for Models page
- [x] `ai:total-cost` — single total for Header indicator
- [x] `ai:usage-by-project` — per-project usage (for future phase pipeline view)

### Preload + Types
- [x] `window.api.ai.{call, reinit, usageSummary, totalCost, usageByProject}` exposed
- [x] Full TypeScript types: `ModelResponse`, `UsageSummaryRow`, `UsageRow`, `TaskType`

### UI
- [x] `Settings.tsx` — triggers `ai:reinit` implicitly after key save (via settings:set handler)
- [x] `Models.tsx` — live per-model usage (cost, tokens, calls) pulled from DB; Refresh button
- [x] `Header.tsx` — live total cost indicator, auto-refreshes every 30s

## Architecture Decisions

- **clients are lazy-init** — missing keys skip init silently; calls throw a user-friendly message
- **reinit on save** — `settings:set` fires `reinitAiClients()` so new keys work immediately, no restart needed
- **usage failures are non-fatal** — if DB write fails, the AI response is still returned
- **Gemini for cheap tasks** — intake/deploy use Gemini Flash to minimise cost
- **Opus only for security** — highest quality/cost model reserved for security audit phase

## Files Created / Modified

| File | Action |
|------|--------|
| `src/main/ai/types.ts` | Created |
| `src/main/ai/claude-base.ts` | Created |
| `src/main/ai/claude-opus.ts` | Created |
| `src/main/ai/gemini.ts` | Created |
| `src/main/ai/router.ts` | Created |
| `src/main/ai/init.ts` | Created |
| `src/main/ipc/ai.ts` | Created |
| `src/main/ipc/settings.ts` | Modified — reinit on key save |
| `src/main/index.ts` | Modified — register AI IPC + init clients |
| `src/preload/index.ts` | Modified — ai bridge |
| `src/preload/index.d.ts` | Modified — ai types |
| `src/renderer/src/pages/Models.tsx` | Modified — live usage data |
| `src/renderer/src/components/layout/Header.tsx` | Modified — live cost total |

## Next (Day 6)

- Phase pipeline IPC + UI (start/stop phases, live log streaming)
- Wire Project detail page to show phase cards with status
