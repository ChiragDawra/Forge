# Day 9 Session Log — Planning phase

## Goal
Per FORGE_PROJECT.md Day 9: build `agent/phases/1-planning.ts`,
`prompts/prd.ts`, `prompts/architecture.ts`, and `PlanViewer.tsx`.
Acceptance: after intake approval, PRD + architecture auto-generated,
shown in PlanViewer.

## What shipped

### Prompts
- **`src/main/agent/prompts/prd.ts`** — system prompt that turns an
  intake JSON into a structured PRD with 8 fixed sections (Overview,
  Problem, Goals, Non-Goals, User Stories, Functional Requirements,
  Non-Functional Requirements, Out of Scope). `buildPrdUserPrompt()`
  formats the expanded brief + non-empty clarifications into the user
  turn. Fed to the planning-class model (Claude Base).
- **`src/main/agent/prompts/architecture.ts`** — system prompt that
  produces strict JSON: stack (frontend/backend/database/auth/hosting),
  folderTree (path + description), keyDecisions (decision + rationale),
  phases (name + description + order). `buildArchitectureUserPrompt()`
  injects the first 2000 chars of the PRD for grounding. Fed to the
  codegen-class model (Claude Base).

### Agent
- **`src/main/agent/phases/1-planning.ts`** — `runPlanning(input, opts)`:
  - PRD call first (planning route), then architecture call (codegen
    route) seeded with the PRD output.
  - Both calls attributed to the projectId for cost tracking.
  - `parseArchitecture()` tolerantly extracts JSON (first `{` / last
    `}`), validates and clamps each sub-field; won't throw on partial
    model output.
  - Returns `PlanningResult` with prd string, typed ArchitectureJson,
    model names, and combined cost.

### IPC
- **`src/main/ipc/phases.ts`** — added `phases:planning:run` handler:
  - Structural re-validation of the `PlanningInput` object at the
    boundary.
  - UUID-validated projectId.
  - Persists `prd.md` + `architecture.json` to
    `<userData>/projects/<projectId>/` in parallel.
  - Rate-limited + audit-logged.

### Renderer
- **`src/renderer/src/components/project/PlanViewer.tsx`** — tabbed
  view (PRD / Architecture):
  - PRD tab: splits markdown on `## ` headings into collapsible sections,
    renders bullet/numbered lines as a clean list.
  - Architecture tab: Stack table, folder tree with depth-indented rows,
    key decisions cards, build phases ordered list.
  - Cost + model attribution badge top-right.
- **`src/renderer/src/pages/Project.tsx`** — Phase 1 section appears
  below the intake approval card. "Run Planning" button triggers the
  IPC call; loading state shows a spinner; on success `PlanViewer`
  replaces the placeholder.

## Verification
- `npm run build` — main (54.23 KB), preload (4.80 KB), renderer
  (484.58 KB). All green, 0 TS errors.

## Files
- new: `src/main/agent/prompts/{prd,architecture}.ts`
- new: `src/main/agent/phases/1-planning.ts`
- new: `src/renderer/src/components/project/PlanViewer.tsx`
- modified: `src/main/ipc/phases.ts`, `src/preload/index.ts`,
  `src/preload/index.d.ts`, `src/renderer/src/pages/Project.tsx`
