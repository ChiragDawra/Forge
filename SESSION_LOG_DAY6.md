# Forge — Day 6 Session Log

**Date:** 2026-04-19
**Goal:** Models Dashboard — per-model UsageCard, 7-day UsageChart, ModelBadge, and daily-aggregation IPC
**Duration:** ~2 hrs

---

## Completed

### Main — DB + IPC
- [x] `src/main/db/schema.ts` — added indexes on `model_usage(called_at)` and `(project_id, called_at)`
- [x] `src/main/db/migrations/0001_worried_harry_osborn.sql` — generated via `drizzle-kit generate`
- [x] `src/main/ipc/ai.ts`:
  - Fixed `callCount` bug — was `sum(id)` (string sum), now `count(id)`
  - Added `lastUsedAt` (via `max(calledAt)`) to `UsageSummaryRow`
  - New `ai:usage-daily` IPC — buckets by `strftime('%Y-%m-%d', ..., 'localtime')`, grouped by day+model, clamped to 1–90 days
  - Added `toMillis()` helper to normalise Drizzle timestamp aggregates (Date | seconds | ms)

### Preload
- [x] `window.api.ai.usageDaily(days?)` exposed
- [x] New `DailyUsageRow` type; `UsageSummaryRow` extended with `lastUsedAt`

### Renderer — Components (new)
- [x] `src/renderer/src/lib/format.ts` — shared `formatCost`, `formatTokens`, `formatRelativeTime`, `modelLabel`, `modelColor`
- [x] `components/usage/ModelBadge.tsx` — coloured inline tag per model
- [x] `components/usage/UsageCard.tsx` — per-model card with cost, tokens, calls, "Last used"
- [x] `components/usage/UsageChart.tsx` — pure-SVG stacked bar chart, last 7 days, toggle Cost↔Tokens (no Chart.js dep)

### Renderer — Consolidation
- [x] `constants.ts` now owns `MODEL_LABELS` + `MODEL_COLORS` keyed off `MODELS` (single source of truth)
- [x] `Models.tsx` rewritten to use new components, memoised totals, Cost/Tokens metric toggle, `console.warn` on load failure
- [x] `Header.tsx` uses shared `formatCost`; `setTotalCost` guarded against no-op updates (stops unnecessary re-renders every 30s)

## Architecture Decisions

- **Pure-SVG chart over Chart.js** — saves ~70 KB + render cost; stacked bars with legend, grid, tooltips via `<title>`
- **`ModelName` typed everywhere** — `UsageCard` / `ModelBadge` / format accessors no longer accept arbitrary strings, removing `as keyof typeof` casts
- **Label/color tables live in `constants.ts`** — colocated with `MODELS` / `MODEL_COSTS` so model renames touch one file
- **Local-TZ bucketing** — SQL `strftime('localtime')` matches the renderer's locally-built 7-day window so buckets align
- **`toMillis()` helper** — Drizzle returns `Date` on direct selects but raw seconds on `max()` / `sql\`...\``; this normalises both

## Review Fixes Applied (simplify skill)

- Consolidated duplicated model metadata into `constants.ts`
- Threaded `ModelName` union through usage components
- Added DB indexes on hot aggregation paths (per efficiency review)
- Memoised totals, guarded setState, logged catch errors
- Replaced `label.replace(/_/g, ' ')` with shared `modelLabel()` (fixes "CLAUDE OPUS" → "Opus" visual consistency with badges)

## Security Review (security-review skill)

- New `ai:usage-daily` raw SQL interpolates only a Drizzle column reference — no user input reaches SQL
- `days` param is `Number()`-coerced and clamped `[1, 90]`
- IPC handler uses existing `validateSender` + `checkRateLimit` + `safeErrorMessage` pattern
- SVG `fill` attributes come from a static hex table — user-influenced `modelName` only keys a lookup with hard-coded fallback
- **Result:** no exploitable vulnerabilities introduced

## Files Created / Modified

| File | Action |
|------|--------|
| `src/main/db/schema.ts` | Modified — indexes on model_usage |
| `src/main/db/migrations/0001_worried_harry_osborn.sql` | Created |
| `src/main/db/migrations/meta/0001_snapshot.json` | Created |
| `src/main/db/migrations/meta/_journal.json` | Modified |
| `src/main/ipc/ai.ts` | Modified — usage-daily, lastUsedAt, callCount fix, toMillis |
| `src/preload/index.ts` | Modified — usageDaily bridge |
| `src/preload/index.d.ts` | Modified — DailyUsageRow, lastUsedAt |
| `src/renderer/src/lib/constants.ts` | Modified — MODEL_LABELS + MODEL_COLORS |
| `src/renderer/src/lib/format.ts` | Created |
| `src/renderer/src/components/usage/ModelBadge.tsx` | Created |
| `src/renderer/src/components/usage/UsageCard.tsx` | Created |
| `src/renderer/src/components/usage/UsageChart.tsx` | Created |
| `src/renderer/src/components/layout/Header.tsx` | Modified — shared formatter, no-op guard |
| `src/renderer/src/pages/Models.tsx` | Modified — new components + chart + metric toggle |

## Verification

- `npm run build` — main (25 KB), preload (3 KB), renderer (456 KB) all build cleanly
- Totals row + per-model cards + chart render; metric toggle flips cost ↔ tokens
- Empty state renders when no usage rows exist ("No activity yet")

## Next (Day 7)

- `tools/repomix.ts` — run `repomix` CLI, parse XML output
- `tools/context7.ts` — library docs lookup
- `agent/task-queue.ts` — GSD decomposer (phase goal → atomic tasks)
- `agent/session-logger.ts` — auto-write SESSION_LOG.md
