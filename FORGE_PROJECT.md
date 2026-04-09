# FORGE — AI Full-Stack App Builder (Desktop)
> Personal private tool. One prompt → full-stack application, built autonomously in phases.
> **Owner:** Chirag | **Model reading this:** Claude Opus 4.6

---

## ⚡ READ THIS FIRST — Context Protection Protocol

Before writing a single line of code, you MUST follow these two steps every session.
They exist to prevent wasted tokens and redundant work.

### Step 1 — Repomix (Code Review Graph)

Repomix compresses the entire codebase into one structured file so you never
need to read individual files one by one. Run this at the START of every session:

```bash
# Install once
npm install -g repomix

# Run at project root every session before starting
repomix --output .repomix-context.xml --ignore "node_modules,dist,.git,*.log"
```

Read `.repomix-context.xml` to understand current state before touching anything.
Never ask "what files exist" — the repomix file tells you.
Never re-read files you already have in the repomix output.

### Step 2 — GSD (Get Shit Done) Protocol

Before executing any task in a session, decompose it using this exact format:

```
CURRENT SESSION GOAL: [one sentence]
TASKS THIS SESSION:
  [ ] Task 1 — specific, one file or one function
  [ ] Task 2 — specific, one file or one function
  [ ] Task 3 — ...
CONTEXT NEEDED: [list only the files from repomix relevant to today's tasks]
OUT OF SCOPE TODAY: [explicitly list what you are NOT doing this session]
```

Rules:
- Each task must be completable in under 20 minutes
- Maximum 6 tasks per 2-hour session
- If a task is "build X feature" — break it down further. That is not a task.
- Mark tasks [x] as done and [ ] as not started before ending the session
- Write a 3-line SESSION SUMMARY at the end of every session to the file `SESSION_LOG.md`

---

## Project Overview

**Name:** Forge  
**Type:** Electron desktop application (macOS primary, Windows compatible)  
**Purpose:** Private personal tool that takes a single prompt and autonomously builds,
tests, secures, and deploys full-stack applications through a structured phase pipeline.  
**Key Principle:** Self-sufficient but not reckless — at defined checkpoints the app
pauses and asks the user for confirmation before proceeding.

### What Forge does (user flow)

1. User opens Forge on their laptop
2. User types a prompt: "Build me a SaaS dashboard for tracking freelance projects with auth"
3. Forge expands the idea, asks 3–5 clarifying questions, user confirms
4. Forge generates: PRD → Tech stack → Architecture → Design prompt
5. Forge pauses → shows the plan → user approves or edits
6. Forge scaffolds the project, generates code phase by phase
7. At each major phase (scaffold, core logic, security, tests, deploy) it pauses for user sign-off
8. User can watch a live log stream of exactly what each model is doing
9. Forge deploys to Vercel and shows the preview URL
10. All model usage (tokens, cost, which model did what) is tracked in the Models Dashboard

---

## Tech Stack

### Desktop Shell
- **Electron 33+** — desktop app container
- **electron-builder** — packaging for macOS (.dmg) and Windows (.exe)
- **electron-store** — encrypted local config (API keys, settings)

### Frontend (inside Electron renderer)
- **React 18 + TypeScript** — UI framework
- **Vite** — bundler (with electron-vite wrapper)
- **Tailwind CSS v3** — styling
- **shadcn/ui** — component library (pre-built, accessible)
- **Lucide React** — icons
- **React Router v6** — navigation between pages
- **Zustand** — global state management
- **React Query (TanStack)** — async state + caching

### Backend (Electron main process)
- **Node.js 20+** (comes with Electron)
- **better-sqlite3** — local SQLite database for project metadata, logs, model usage
- **Drizzle ORM** — type-safe SQLite queries
- **keytar** — OS keychain integration for storing API keys securely
- **execa** — running shell commands (repomix, npm audit, semgrep, playwright)
- **node-fetch / axios** — HTTP calls to AI APIs
- **ws** — WebSocket server for streaming AI responses to renderer

### AI / Model Layer
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude Base + Opus calls
- **Google Generative AI SDK** (`@google/generative-ai`) — Gemini Pro calls
- Custom model router in `src/main/ai/router.ts`

### MCP Tools (run as child processes from main process)
- `@modelcontextprotocol/server-filesystem` — file read/write for generated projects
- `@modelcontextprotocol/server-github` — GitHub repo creation, PR management
- `@modelcontextprotocol/server-memory` — cross-session project state
- `@playwright/mcp` — browser-based E2E testing
- `repomix` — codebase compression (CLI, not MCP)
- `context7` — live library docs (npx context7)

### External APIs
See full API list section below.

### Database Schema (SQLite via Drizzle)
Tables:
- `projects` — id, name, prompt, status, tech_stack, created_at, updated_at
- `phases` — id, project_id, phase_name, status, started_at, completed_at
- `phase_logs` — id, phase_id, timestamp, level, message
- `model_usage` — id, project_id, phase_id, model_name, input_tokens, output_tokens, cost_usd, called_at
- `api_keys` — stored in OS keychain via keytar, NOT in SQLite
- `sessions` — id, project_id, started_at, ended_at, summary

---

## Full File Structure

```
forge/
├── electron.vite.config.ts          # Build config
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── drizzle.config.ts
├── SESSION_LOG.md                   # Written by Opus each session
├── .repomix-context.xml             # Generated by repomix each session
│
├── src/
│   ├── main/                        # Electron main process (Node.js)
│   │   ├── index.ts                 # App entry, window creation
│   │   ├── ipc/                     # IPC handlers
│   │   │   ├── projects.ts          # create, read, update projects
│   │   │   ├── agent.ts             # trigger phase, get status
│   │   │   ├── settings.ts          # API key get/set via keytar
│   │   │   └── models.ts            # usage stats queries
│   │   ├── db/
│   │   │   ├── schema.ts            # Drizzle schema definitions
│   │   │   ├── migrations/          # Auto-generated by drizzle-kit
│   │   │   └── client.ts            # DB connection singleton
│   │   ├── ai/
│   │   │   ├── router.ts            # Routes tasks to correct model
│   │   │   ├── claude-base.ts       # Claude Base API calls + token tracking
│   │   │   ├── claude-opus.ts       # Opus 4.6 calls + token tracking
│   │   │   ├── gemini.ts            # Gemini Pro calls + token tracking
│   │   │   └── prompts/             # All system prompts as .ts files
│   │   │       ├── intake.ts        # Prompt expansion + clarification
│   │   │       ├── prd.ts           # PRD generation (Gemini)
│   │   │       ├── architecture.ts  # Tech stack + file structure
│   │   │       ├── design.ts        # Design prompt generator
│   │   │       ├── codegen.ts       # Code generation (Opus)
│   │   │       ├── review.ts        # Code review (Base + GSD)
│   │   │       └── security.ts      # OWASP + security audit
│   │   ├── agent/
│   │   │   ├── orchestrator.ts      # Phase manager, runs the pipeline
│   │   │   ├── phases/
│   │   │   │   ├── 0-intake.ts      # Prompt parsing + clarification
│   │   │   │   ├── 1-planning.ts    # PRD + architecture
│   │   │   │   ├── 2-design.ts      # Design prompt + UI mapping
│   │   │   │   ├── 3-scaffold.ts    # File structure creation
│   │   │   │   ├── 4-codegen.ts     # Core code generation
│   │   │   │   ├── 5-review.ts      # Code review + improvement
│   │   │   │   ├── 6-security.ts    # Security audit
│   │   │   │   ├── 7-testing.ts     # Playwright E2E tests
│   │   │   │   └── 8-deploy.ts      # Vercel deployment
│   │   │   ├── context-manager.ts   # Repomix + Context7 integration
│   │   │   ├── task-queue.ts        # GSD task breakdown + queue
│   │   │   └── session-logger.ts    # Writes SESSION_LOG.md
│   │   ├── tools/
│   │   │   ├── repomix.ts           # Runs repomix CLI, parses output
│   │   │   ├── context7.ts          # Fetches live library docs
│   │   │   ├── filesystem-mcp.ts    # File R/W for generated projects
│   │   │   ├── github-mcp.ts        # GitHub operations
│   │   │   ├── playwright-mcp.ts    # E2E test runner
│   │   │   ├── semgrep.ts           # Security static analysis
│   │   │   ├── npm-audit.ts         # Dependency vulnerability scan
│   │   │   └── vercel.ts            # Deploy via Vercel API
│   │   └── preload.ts               # Electron contextBridge (IPC bridge)
│   │
│   ├── renderer/                    # React frontend
│   │   ├── index.html
│   │   ├── main.tsx                 # React entry
│   │   ├── App.tsx                  # Router setup
│   │   ├── store/
│   │   │   ├── project.store.ts     # Active project state
│   │   │   ├── agent.store.ts       # Pipeline phase state + logs
│   │   │   └── settings.store.ts    # App settings
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Project list / new project
│   │   │   ├── Project.tsx          # Active project view (main work area)
│   │   │   ├── Settings.tsx         # API keys + preferences
│   │   │   └── Models.tsx           # Model usage dashboard
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx      # Left nav: projects list
│   │   │   │   ├── Header.tsx       # Top bar with model usage indicator
│   │   │   │   └── Layout.tsx       # Root layout wrapper
│   │   │   ├── project/
│   │   │   │   ├── PromptInput.tsx  # Initial prompt textarea + submit
│   │   │   │   ├── PhaseTracker.tsx # Visual stepper for 9 phases
│   │   │   │   ├── LogStream.tsx    # Live log output (terminal-style)
│   │   │   │   ├── ApprovalGate.tsx # Pause + confirm modal
│   │   │   │   ├── PlanViewer.tsx   # Shows PRD + architecture before approval
│   │   │   │   └── DeployResult.tsx # Preview URL + deploy status
│   │   │   ├── models/
│   │   │   │   ├── UsageCard.tsx    # Per-model token + cost card
│   │   │   │   ├── UsageChart.tsx   # Chart.js bar chart of usage over time
│   │   │   │   └── ModelBadge.tsx   # Small inline indicator of which model ran
│   │   │   └── ui/                  # shadcn components (auto-generated, don't edit)
│   │   └── lib/
│   │       ├── ipc.ts               # Type-safe IPC calls to main process
│   │       ├── utils.ts             # shadcn utility (cn function)
│   │       └── constants.ts         # Phase names, model names, cost rates
│   │
├── resources/
│   └── icon.png                     # App icon
│
└── generated-projects/              # All output projects live here
    └── [project-slug]/              # Each generated project in its own folder
```

---

## All APIs Required

### Mandatory (core pipeline)

| API | Purpose | Get key at | Env var name |
|-----|---------|-----------|-------------|
| Anthropic API (Base account) | Planning, review, intake | console.anthropic.com | `ANTHROPIC_BASE_KEY` |
| Anthropic API (Pro account) | Opus 4.6 code generation | console.anthropic.com | `ANTHROPIC_OPUS_KEY` |
| Google Gemini API | Long-context PRD generation | aistudio.google.com | `GEMINI_API_KEY` |
| Vercel API | Auto-deploy generated apps | vercel.com/account/tokens | `VERCEL_TOKEN` |
| GitHub Personal Access Token | Repo creation, GitHub MCP | github.com/settings/tokens | `GITHUB_TOKEN` |

### Optional but high-value (add in Phase 6+)

| API | Purpose | Get key at | Cost |
|-----|---------|-----------|------|
| Tavily API | Web search during planning | tavily.com | Free tier |
| Upstash | Redis for generated apps that need caching | upstash.com | Free tier |
| Resend | Email in generated apps | resend.com | Free 3k/month |
| Supabase | DB + auth in generated apps | supabase.com | Free tier |
| Snyk | Deeper security scanning | snyk.io | Free tier |

### API Key Storage
All keys are stored in the OS keychain via `keytar`, NOT in .env files.
The Settings page (`/settings`) has input fields for each key.
Main process reads them via `keytar.getPassword('forge', keyName)`.
Never hardcode any key. Never log any key. Never put keys in the database.

### Model Routing Rules (implement exactly as below)

```
TASK TYPE                          → MODEL              REASON
─────────────────────────────────────────────────────────────
Prompt parsing / intent extraction → Claude Base        Fast, cheap
PRD generation (long form)         → Gemini 2.0 Flash   1M context
Architecture + tech stack design   → Claude Base        Well-trained
Design prompt generation           → Claude Base        Creative, cheap  
File scaffold (structure only)     → Claude Base        Templating
Core business logic                → Claude Opus 4.6    Hard reasoning
Auth / payment / complex flows     → Claude Opus 4.6    Hard reasoning
API integration code               → Claude Opus 4.6    Accuracy needed
Routine code (CRUD, components)    → Claude Base        Save Opus tokens
Code review pass                   → Claude Base        Systematic
Security OWASP check               → Claude Base        Checklist work
Test writing                       → Claude Base        Pattern matching
Security report synthesis          → Claude Opus 4.6    Judgment needed
Deploy config generation           → Claude Base        Template work
```

### Token Cost Tracking (for Models Dashboard)
Track and display exact costs. Use these rates per 1M tokens:

```
Claude Opus 4.6:    input $15.00 / output $75.00
Claude Base (3.5S): input $3.00  / output $15.00
Gemini 2.0 Flash:   input $0.10  / output $0.40
```

Store every API call in `model_usage` table with: model_name, input_tokens, output_tokens,
computed cost_usd, project_id, phase_id, timestamp.

---

## Phase Details & Approval Gates

### Phase 0 — Prompt Intake
**Model:** Claude Base  
**User sees:** Clarifying questions (max 5)  
**Approval gate:** User confirms the expanded idea before anything is generated  
**Output:** `{project}/intake.json` — intent, features list, constraints, preferred stack hints

### Phase 1 — Planning (PRD + Architecture)
**Models:** Gemini (PRD), Claude Base (architecture)  
**User sees:** Full PRD displayed in app, tech stack recommendation, folder structure preview  
**Approval gate:** HARD STOP — user must read and approve the plan. Allow inline edits.  
**Output:** `{project}/prd.md`, `{project}/architecture.json`

### Phase 2 — Design
**Model:** Claude Base (design prompt), external (Stitch/v0 — manual step)  
**User sees:** Generated design prompt, instructions to paste into Stitch or v0.dev  
**Approval gate:** User uploads/pastes the UI output (screenshot or component code)  
**Output:** `{project}/design-prompt.md`, `{project}/ui-components.json`

### Phase 3 — Scaffold
**Model:** Claude Base + Filesystem MCP  
**User sees:** Live log of files being created  
**Approval gate:** Show tree of created files — user confirms before codegen starts  
**Output:** Complete project folder at `generated-projects/{slug}/`

### Phase 4 — Code Generation
**Model:** Claude Opus 4.6 (primary), Claude Base (routine components)  
**User sees:** Live streaming log of what Opus is generating, component by component  
**Approval gate:** After every 5 files, show summary + allow user to pause or redirect  
**Output:** All source files written to `generated-projects/{slug}/src/`

### Phase 5 — Code Review
**Model:** Claude Base  
**User sees:** Review report — issues found, improvements made, list of changes  
**Approval gate:** Show diff of changes — user approves before writing to disk  
**Output:** Improved files + `{project}/review-report.md`

### Phase 6 — Security Audit
**Tools:** Semgrep, npm audit, Claude Base (OWASP checklist)  
**User sees:** Security report with severity levels (critical / high / medium / low)  
**Approval gate:** If any CRITICAL issues: HARD STOP, must fix before proceeding  
**Output:** `{project}/security-report.md`, auto-fixed files where possible

### Phase 7 — Testing
**Tool:** Playwright MCP  
**User sees:** Test run results, pass/fail per user story, screenshots of failures  
**Approval gate:** All critical user stories must pass. User can waive non-critical.  
**Output:** `{project}/test-results/`, Playwright test files in `generated-projects/{slug}/tests/`

### Phase 8 — Deploy
**Tool:** Vercel API  
**User sees:** Deploy progress, then preview URL  
**Approval gate:** None (fully automatic after Phase 7 passes)  
**Output:** Preview URL shown in app, stored in project record

---

## Roadmap — Sessions at 2hrs/day

Estimated total: **44 hours** → **22 working days** at 2 hrs/day  
Each session block = 2 hours. Context window assumption: 5 hours = 2.5 sessions.

### Week 1 — Foundation (Days 1–7, 14 hrs)

**Day 1 (Session 1) — Project setup**
- Init Electron + Vite + React + TypeScript using `electron-vite` template
- Configure Tailwind + shadcn/ui
- Set up `better-sqlite3` + Drizzle with initial schema
- Verify app launches, hot reload works
- Acceptance: `npm run dev` opens a blank Electron window with no errors

**Day 2 (Session 2) — Main layout + routing**
- Build `Layout.tsx`, `Sidebar.tsx`, `Header.tsx`
- Set up React Router: `/` (Home), `/project/:id`, `/settings`, `/models`
- Build `Home.tsx` — empty project list + "New Project" button
- Acceptance: Can navigate between all 4 pages without crash

**Day 3 (Session 3) — Settings + API key storage**
- Install `keytar`, wire up IPC handler `settings.ts`
- Build `Settings.tsx` page — input field per API key, save button
- Keys saved to OS keychain, masked in UI
- Build `constants.ts` with all model names + cost rates
- Acceptance: Can save/retrieve API keys, confirm they survive app restart

**Day 4 (Session 4) — Database + project creation**
- Finalize all Drizzle schema tables (projects, phases, phase_logs, model_usage)
- Run `drizzle-kit generate` + `drizzle-kit migrate`
- Build `projects.ts` IPC handler — createProject, listProjects, getProject
- Wire `Home.tsx` to create and list projects
- Acceptance: Can create a project, see it in sidebar, click to open

**Day 5 (Session 5) — Claude Base + Gemini clients**
- Build `claude-base.ts` — wrapper with token counting + `model_usage` DB write
- Build `gemini.ts` — same pattern
- Build `claude-opus.ts` — same pattern
- Build `router.ts` — exports `routeTask(taskType)` → returns correct client
- Write unit test: call each client with "say hello", verify token count logged
- Acceptance: All 3 APIs callable, usage written to DB, no key exposure in logs

**Day 6 (Session 6) — Models Dashboard**
- Build `Models.tsx` page
- Build `UsageCard.tsx` — shows per-model: total tokens, total cost, last used
- Build `UsageChart.tsx` — Chart.js bar chart: usage per model over last 7 days
- Build `ModelBadge.tsx` — small inline tag showing which model handled a task
- Wire to `model_usage` table via IPC
- Acceptance: Run 3 test API calls, see accurate cost breakdown on Models page

**Day 7 (Session 7) — Repomix + Context7 + GSD task queue**
- Build `tools/repomix.ts` — runs `repomix` CLI, reads output XML, returns summary
- Build `tools/context7.ts` — given library name + version, returns current docs
- Build `agent/task-queue.ts` — GSD decomposer: takes a phase goal, returns atomic tasks
- Build `agent/session-logger.ts` — writes session summary to `SESSION_LOG.md`
- Acceptance: `repomix.ts` can summarize a test project, `task-queue.ts` can decompose "build auth"

---

### Week 2 — Agent Core (Days 8–14, 14 hrs)

**Day 8 (Session 8) — Prompt intake phase**
- Build `agent/phases/0-intake.ts`
- Write `prompts/intake.ts` — system prompt for expanding prompt + generating clarifying Qs
- Build `PromptInput.tsx` — large textarea, submit button
- Build `ApprovalGate.tsx` — modal that pauses pipeline, shows content, confirm/edit/cancel
- Acceptance: Type a prompt, see 3–5 clarifying questions, answer them, see `intake.json` created

**Day 9 (Session 9) — Planning phase**
- Build `agent/phases/1-planning.ts`
- Write `prompts/prd.ts` — PRD prompt for Gemini (long-form, structured)
- Write `prompts/architecture.ts` — tech stack + folder tree prompt for Claude Base
- Build `PlanViewer.tsx` — renders PRD markdown + architecture JSON in readable layout
- Acceptance: After intake approval, PRD + architecture auto-generated, shown in PlanViewer

**Day 10 (Session 10) — Orchestrator + phase manager**
- Build `agent/orchestrator.ts` — the central loop that runs phases 0–8 in sequence
- Each phase: runs phase module → logs to `phase_logs` → emits IPC event to renderer → waits for approval if needed
- Build `PhaseTracker.tsx` — visual stepper (0 of 8, current phase highlighted)
- Build streaming log: main process sends log lines via IPC, `LogStream.tsx` renders them
- Acceptance: Phases 0 and 1 run in sequence with full log output visible in renderer

**Day 11 (Session 11) — Design phase**
- Build `agent/phases/2-design.ts`
- Write `prompts/design.ts` — generates precise, opinionated design brief from PRD
- Show design prompt in app with "Copy" button + instructions for Stitch/v0
- After user pastes/uploads result, extract component list via Claude Base
- Acceptance: Full design prompt generated, user can paste v0 output, component map extracted

**Day 12 (Session 12) — Scaffold phase + Filesystem MCP**
- Build `tools/filesystem-mcp.ts` — wraps `@modelcontextprotocol/server-filesystem`
- Build `agent/phases/3-scaffold.ts`
- Uses Claude Base to generate folder tree JSON from architecture → writes actual files
- Show file tree in `PhaseTracker.tsx` approval gate before committing
- Acceptance: After approval, `generated-projects/{slug}/` exists with correct structure

**Day 13 (Session 13) — Code generation phase (part 1)**
- Build `agent/phases/4-codegen.ts` — outer loop
- Build `agent/context-manager.ts` — runs repomix on generated project, fetches Context7 docs
- Implement per-component code generation loop: for each component in ui-components.json, call Opus
- Write `prompts/codegen.ts` — Opus system prompt with repomix context + docs + component spec
- Acceptance: First 3 components generated into correct file locations

**Day 14 (Session 14) — Code generation phase (part 2)**
- Complete codegen loop: backend routes, DB models, API handlers
- Implement the "pause every 5 files" approval gate
- Ensure Opus uses Context7 docs for every library call (no stale APIs)
- Handle errors: if a file fails, log it, skip, continue — don't crash the whole pipeline
- Acceptance: A simple CRUD app generates end-to-end without manual intervention

---

### Week 3 — Quality + Delivery (Days 15–22, 16 hrs)

**Day 15 (Session 15) — Code review phase**
- Build `agent/phases/5-review.ts`
- Write `prompts/review.ts` — GSD-based review: dead code, error handling, types, imports
- Show diff of before/after in `ApprovalGate.tsx` before writing changes
- Acceptance: Review phase finds and fixes at least 3 real issues in a test project

**Day 16 (Session 16) — Security audit phase**
- Build `tools/semgrep.ts` — runs `semgrep --config=auto`, parses JSON output
- Build `tools/npm-audit.ts` — runs `npm audit --json`, parses vulnerabilities
- Build `agent/phases/6-security.ts`
- Write `prompts/security.ts` — OWASP Top 10 checklist prompt for Claude Base
- Build security report view: severity badges, issue list, auto-fix where possible
- Acceptance: CRITICAL issues block pipeline, others shown in report

**Day 17 (Session 17) — Playwright testing phase**
- Build `tools/playwright-mcp.ts`
- Build `agent/phases/7-testing.ts`
- Claude Base generates Playwright test file from user stories in PRD
- Run tests, capture results + screenshots of failures
- Show pass/fail per user story in approval gate
- Acceptance: Generated tests run against a scaffold app, results shown in UI

**Day 18 (Session 18) — Deploy phase**
- Build `tools/vercel.ts` — calls Vercel API to create deployment
- Build `agent/phases/8-deploy.ts`
- On successful deploy, store preview URL in `projects` table
- Build `DeployResult.tsx` — shows URL, copy button, open in browser button
- Wire GitHub MCP to create repo + push code before deploying
- Acceptance: End-to-end test project deploys and shows live preview URL

**Day 19 (Session 19) — Memory MCP + cross-session resume**
- Build integration with `@modelcontextprotocol/server-memory`
- On session end: write current phase, completed tasks, key decisions to memory
- On session start: load memory → orchestrator knows exactly where to resume
- Add "Resume last session" button on project page
- Acceptance: Close app mid-Phase 4, reopen, click Resume — picks up correctly

**Day 20 (Session 20) — Full pipeline integration test**
- Run complete pipeline on a real prompt: "Build a task tracker with auth and dark mode"
- Fix all integration issues found
- Measure: total cost, total time, phases that needed human correction
- Acceptance: Complete run from prompt to Vercel URL with no crashes

**Day 21 (Session 21) — UI polish + error states**
- Add loading skeletons to all async views
- Add error boundaries + friendly error messages per phase
- Add "Cancel pipeline" button that cleanly stops current phase
- Add keyboard shortcuts: Cmd+N (new project), Cmd+, (settings)
- Acceptance: Every error state handled gracefully, no blank screens or uncaught throws

**Day 22 (Session 22) — Packaging + final QA**
- Configure `electron-builder` for macOS .dmg output
- Run `npm run build` — verify packaged app launches and all features work
- Write final README.md in project root
- Final acceptance test: fresh install, set API keys, run full pipeline on one project
- Acceptance: Distributable .dmg works on a fresh machine with no dev tools

---

## Context Window Management Rules

These rules protect you from wasting tokens on large sessions:

1. **Never load the full codebase into context.** Use repomix output only.
2. **Per-session context budget:** load only files relevant to today's tasks (from GSD list).
3. **For Opus calls:** context = repomix summary (5k tokens max) + Context7 docs (3k max) + specific component spec (2k max). Hard cap: 12k tokens per Opus call input.
4. **For Base calls:** context = task description + relevant file content only. No repomix needed.
5. **If a task requires reading more than 3 files in full:** break the task into smaller sub-tasks.
6. **Session boundary rule:** At 1hr 45min into a 2hr session, stop new tasks. Use remaining time to write SESSION_LOG.md and run repomix for next session.

---

## Approval Gate Design Rules

These are UX rules for how approval gates must behave:

- Every gate shows: what was done, what will happen next, estimated tokens/cost for next phase
- Cancel always stops the pipeline cleanly (no partial writes)
- Edit means: user can modify the content (e.g., edit the PRD) before approval
- Approve triggers the next phase
- Gates must never time out or auto-approve
- Gates for CRITICAL security issues show a red warning banner and the only option is "Fix and re-run"

---

## How to Start — First Session Instructions for Opus

Read this section first on Day 1.

1. Run: `npx create-electron-vite forge --template react-ts`
2. `cd forge`
3. Install core deps:
   ```bash
   npm install better-sqlite3 drizzle-orm @anthropic-ai/sdk @google/generative-ai
   npm install keytar electron-store execa zustand @tanstack/react-query
   npm install tailwindcss @tailwindcss/typography postcss autoprefixer
   npm install -D drizzle-kit @types/better-sqlite3
   npx shadcn-ui@latest init
   npm install -g repomix
   ```
4. Replace default `src/` with the file structure above (create empty files first)
5. Set up `drizzle.config.ts` pointing to `~/Library/Application Support/Forge/forge.db`
6. Verify `npm run dev` opens a window — even a blank one with no errors is success for Day 1
7. Write your first SESSION_LOG.md entry

Do not try to build multiple layers in one session. One layer at a time.
When in doubt: write the type, then the function, then the test, then the UI. Never skip steps.

---

## Quality Standards

Every file Opus generates must meet these before being committed:

- TypeScript: no `any` types unless explicitly justified in a comment
- All async functions: try/catch with meaningful error messages
- All IPC handlers: validate input before processing
- All API calls: log start, log end, log token count to `model_usage` table
- No hardcoded strings: use `constants.ts`
- No API keys in any file except retrieved from keytar at runtime
- Every component: has loading state, error state, and empty state handled

---

*File generated for Opus 4.6 to read and build from. Last updated: April 2026.*
*Share this file at the start of every session. Opus should read it, run repomix, declare GSD tasks, then build.*
