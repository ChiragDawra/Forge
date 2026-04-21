# Day 7 Session Log — Tools + Agent scaffolding

## Goal
Per FORGE_PROJECT.md Day 7: build `tools/repomix.ts`, `tools/context7.ts`,
`agent/task-queue.ts`, `agent/session-logger.ts`. Acceptance: repomix
summarises a project; task-queue decomposes "build auth".

## What shipped

### Tools
- **`src/main/tools/repomix.ts`** — execa wrapper around pinned
  `repomix@1.13.1`. Writes XML to a tmp path, stat-gates size (25 MB cap)
  before reading, then regex-parses `<file path="...">…</file>` blocks into
  a `RepomixSummary` with total chars, top-25 files, and an estimated
  token count (4 chars/token). argv-only invocation — no shell.
- **`src/main/tools/context7.ts`** — `fetch` wrapper for
  `https://context7.com/api/v1/<lib>?type=txt&tokens=N&topic=T`. Library
  id is regex-whitelisted and per-segment URL-encoded. 15 s timeout via
  AbortController; body capped at `tokens * 10` bytes via a streaming
  reader that aborts the response on overrun.

### Agent
- **`src/main/agent/task-queue.ts`** — `decomposeGoal(goal, opts)`
  routes through the planning-class model. Tolerant JSON extractor
  (grabs first `{` / last `}`) and strict validator: id ≥ 1, non-empty
  title, estimate ∈ {S,M,L}, dependsOn integer[]. Hard cap 20 tasks.
- **`src/main/agent/session-logger.ts`** — joins `sessions` +
  `projects` + aggregates `model_usage` within the session's
  `startedAt..endedAt` window, renders a markdown log (metadata,
  narrative, usage table with totals) and writes it to disk.

### IPC + preload
- **`src/main/ipc/tools.ts`** — `tools:repomix`, `tools:context7`
  handlers. Per-handler: `validateSender`, `checkRateLimit`,
  `assertSafeString`, `auditLog`, `safeErrorMessage`. `projectRoot`
  must be absolute + existing directory. `ignore` entries that start
  with `-` are dropped so callers can't smuggle CLI flags (e.g.
  `--output /evil/path`) as ignore globs.
- **`src/main/ipc/agent.ts`** — `agent:decompose` (threads
  projectId + phaseId for usage attribution), `agent:write-session-log`.
  Session-log outPath is constrained to `<userData>/session-logs/`
  with a mandatory `.md` extension — blocks arbitrary file write.
- **`src/preload/index.ts` / `.d.ts`** — exposes `window.api.tools.*`
  and `window.api.agent.*` with full type definitions.
- **`src/main/index.ts`** — registers the two new IPC modules after
  `registerAiIpc()`.

## Security review highlights (applied)
- **H-1 Arbitrary file write** (agent:write-session-log) → pinned to
  `<userData>/session-logs/` + `.md` extension.
- **M-1 Argv injection via `--ignore`** (tools:repomix) → reject
  leading-`-` ignore values; pin `repomix@1.13.1` so `npx` can't fetch
  newer CLIs with different flag semantics.
- Per-segment `encodeURIComponent` for Context7 library ids (not
  `encodeURI`). Content-Length + streaming byte-cap on responses.
- `stat()` before `readFile()` in repomix so we don't buffer a 25 MB
  XML blob only to reject it afterwards.

## Verification
- `npm run build` — main (40.7 KB), preload (3.62 KB), renderer
  (456.23 KB) all green. No TS errors.
- code-review-graph mapped the repo (35 files / 92 nodes / 618 edges)
  before planning — gave a structural view without having to open the
  full tree manually.

## Files
- new: `src/main/tools/{repomix,context7}.ts`
- new: `src/main/agent/{task-queue,session-logger}.ts`
- new: `src/main/ipc/{tools,agent}.ts`
- modified: `src/main/index.ts`, `src/preload/index.ts`,
  `src/preload/index.d.ts`
