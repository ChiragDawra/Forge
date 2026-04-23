# Day 8 Session Log — Intake phase

## Goal
Per FORGE_PROJECT.md Day 8: build `agent/phases/0-intake.ts`, the
`prompts/intake.ts` system prompt, `PromptInput.tsx`, and
`ApprovalGate.tsx`. Acceptance: typing a prompt yields 3–5 clarifying
questions, user answers them, `intake.json` is created.

## What shipped

### Agent
- **`src/main/agent/prompts/intake.ts`** — system prompt that expands a
  user idea into a 3–6 sentence brief and asks 3–5 clarifying questions
  with strict JSON output. `buildIntakeUserPrompt()` helper keeps
  formatting pure so it's cheap to test.
- **`src/main/agent/phases/0-intake.ts`** — two-step phase:
  - `runIntake(rawIdea, opts)` — routes through `'intake'` task type
    (Gemini Flash), logs usage, and tolerantly parses JSON (grabs first
    `{` / last `}`). Validates each question: integer id ≥ 1, non-empty
    text. Hard cap 5 questions.
  - `runFinalise(draft, answers)` — pure local merge into the canonical
    `IntakeJson` shape; no model call, safe to replay.

### IPC
- **`src/main/ipc/phases.ts`** — two handlers behind
  `validateSender` + `checkRateLimit` + `assertSafeString`:
  - `phases:intake:run` — UUID-validates projectId, caps rawIdea at
    10 KB.
  - `phases:intake:finalise` — structural check on the draft (a
    compromised preload shouldn't be able to pass arbitrary objects),
    answers capped at 20 entries × 4 KB, persists `intake.json` to
    `<userData>/projects/<projectId>/intake.json`. Per-project
    directory isolates writes; projectId regex guards against path
    traversal.

### Renderer
- **`src/renderer/src/components/project/PromptInput.tsx`** — large
  textarea with live char count, 20-char minimum gate, trim-on-submit.
- **`src/renderer/src/components/project/ApprovalGate.tsx`** — modal
  with three exits (Approve / Edit prompt / Cancel). Auto-focuses the
  first answer input, Esc cancels, resets answer state on fresh draft.
  Shows expanded brief + questions with per-question rationale.
- **`src/renderer/src/pages/Project.tsx`** — wired the two new
  components into the existing project view; on approval, renders a
  compact success card with the expanded brief + collapsible
  clarifications.

### Plumbing
- **`src/main/index.ts`** — registered `registerPhasesIpc()` after
  `registerAgentIpc()`.
- **`src/preload/index.ts` / `.d.ts`** — exposes
  `window.api.phases.intakeRun` + `window.api.phases.intakeFinalise`
  with full types (`IntakeDraft`, `IntakeAnswer`, `IntakeJson`).

## Security notes
- `projects/<projectId>/` write path is UUID-regex-validated to prevent
  `..` traversal breaking out of userData.
- Draft object is structurally re-validated at the IPC boundary even
  though it came from our own preload — defence against a compromised
  renderer.
- Rate-limited per channel (20 req/sec) via the shared security module.
- No PromptInput content is logged; audit only records `projectId` and
  output path.

## Verification
- `npm run build` — main (47.46 KB), preload (4.70 KB), renderer
  (470.67 KB) all green.

## Files
- new: `src/main/agent/prompts/intake.ts`
- new: `src/main/agent/phases/0-intake.ts`
- new: `src/main/ipc/phases.ts`
- new: `src/renderer/src/components/project/{PromptInput,ApprovalGate}.tsx`
- modified: `src/main/index.ts`, `src/preload/index.ts`,
  `src/preload/index.d.ts`, `src/renderer/src/pages/Project.tsx`
