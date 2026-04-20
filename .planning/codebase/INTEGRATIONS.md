# External Integrations

**Analysis Date:** 2026-04-20

## APIs & External Services

**AI Models:**
- Claude Sonnet 4.5 - Anthropic's mid-tier model for code generation and analysis
  - SDK/Client: `@anthropic-ai/sdk` v0.51.0
  - Env var: `ANTHROPIC_BASE_KEY`
  - Implementation: `src/main/ai/claude-base.ts` with cost tracking ($3.00/$15.00 per 1M tokens in/out)
  
- Claude Opus 4 - Anthropic's flagship model for complex reasoning
  - SDK/Client: `@anthropic-ai/sdk` v0.51.0
  - Env var: `ANTHROPIC_OPUS_KEY`
  - Implementation: `src/main/ai/claude-opus.ts` with cost tracking ($15.00/$75.00 per 1M tokens in/out)

- Gemini 2.0 Flash - Google's multimodal model
  - SDK/Client: `@google/generative-ai` v0.24.0
  - Env var: `GEMINI_API_KEY`
  - Implementation: `src/main/ai/gemini.ts` with cost tracking ($0.10/$0.40 per 1M tokens in/out)

**Model Router:**
- `src/main/ai/router.ts` routes tasks (intake, planning, codegen, review, security, testing, deploy, generic) to appropriate model
- All models return `ModelResponse` with `content`, `inputTokens`, `outputTokens`, `costUsd`, `model`

## Data Storage

**Databases:**
- SQLite 3.x via better-sqlite3 12.8.0
  - Connection: Local file at Electron userData path + `forge.db`
  - Dev override: `FORGE_DB_URL` env var (defaults to `.local/forge-dev.db`)
  - Client: Drizzle ORM with schema at `src/main/db/schema.ts`
  - Initialized: `src/main/db/client.ts` with WAL mode and foreign keys enabled
  - Migrations: Auto-run from `src/main/db/migrations/` on startup

**Schema Tables:**
- `projects` - Project metadata (id, name, prompt, status, techStack, timestamps)
- `phases` - Execution phases per project (id, projectId, phaseName, status, timestamps)
- `phaseLogs` - Phase execution logs (id, phaseId, timestamp, level, message)
- `modelUsage` - AI model call tracking (id, projectId, phaseId, modelName, tokens, cost, calledAt)
- `sessions` - Project work sessions (id, projectId, startedAt, endedAt, summary)
- Indexes: `idx_model_usage_called_at`, `idx_model_usage_project_called_at` for query performance

**File Storage:**
- Local filesystem only - No cloud file storage integration detected
- Generated projects saved to `generated-projects/*/` (excluded from git)

**Caching:**
- In-memory via Zustand store: `src/renderer/src/lib/stores/projects.ts`
- React Query for server state caching of AI responses

## Authentication & Identity

**Auth Provider:**
- Custom credential storage approach (no third-party auth service)
  - Implementation: OS keychain via `keytar` 7.9.0
  - Service name: 'forge'
  - Keys stored: ANTHROPIC_BASE_KEY, ANTHROPIC_OPUS_KEY, GEMINI_API_KEY, VERCEL_TOKEN, GITHUB_TOKEN
  - Storage: macOS Keychain, Windows Credential Manager, Linux Secret Service

**Allowed Settings Keys:**
- Whitelist enforced at `src/main/ipc/settings.ts` with `VALID_KEYS` set
- Only AI API keys and deployment tokens allowed; no user authentication for app access

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Datadog, or similar integration

**Logs:**
- Console logging: `console.log()`, `console.warn()`, `console.error()`
- Audit logging: `src/main/ipc/security.ts` with `auditLog()` function
- Phase execution logs stored in `phaseLogs` table via `src/main/ipc/ai.ts`
- Log format: `[Component] message` (e.g., `[DB] Initialized`, `[AI] Claude Base initialised`)

## CI/CD & Deployment

**Hosting:**
- Desktop application (Electron) - Not a hosted service
- Local machine execution only

**Build/Package:**
- electron-builder 25.1.8 for cross-platform packaging
- Build targets: macOS DMG, Windows NSIS
- Output: `dist/` directory
- Scripts: `npm run build` (compile), `npm run package` (build + bundle)

**Optional Deployment Tokens:**
- `VERCEL_TOKEN` - Stored in keychain for potential Vercel deployments
- `GITHUB_TOKEN` - Stored in keychain for code generation workflows

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_BASE_KEY` or `ANTHROPIC_OPUS_KEY` - At least one Claude key required
- `GEMINI_API_KEY` - Optional; app functions without it (will show "not initialised" error)

**Optional env vars:**
- `VERCEL_TOKEN` - For deployment integrations (not yet active in code)
- `GITHUB_TOKEN` - For code generation workflows (not yet active in code)
- `FORGE_DB_URL` - Override dev database location (defaults to `.local/forge-dev.db`)

**Secrets location:**
- All sensitive credentials stored in OS keychain (not .env files)
- `.env` in `.gitignore` - Environment files never committed
- Settings IPC validates keys against whitelist: `ANTHROPIC_BASE_KEY`, `ANTHROPIC_OPUS_KEY`, `GEMINI_API_KEY`, `VERCEL_TOKEN`, `GITHUB_TOKEN`

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook endpoints exposed

**Outgoing:**
- Model API calls to Anthropic and Google endpoints
- Process execution via `execa` for code generation/deployment (subprocess communication)
- No external webhook notifications configured

## Rate Limiting

**IPC Rate Limiting:**
- `checkRateLimit()` enforced at `src/main/ipc/security.ts` for all IPC handlers
- Prevents rapid successive calls to AI, settings, and project operations
- Rate limit window and thresholds: defined in `src/main/ipc/security.ts`

## Security

**Sender Validation:**
- `validateSender()` at `src/main/ipc/security.ts` ensures IPC calls come from preload/renderer
- Prevents context isolation bypasses

**Content Security:**
- CSP headers in production: only 'self' for scripts and styles
- Sandbox enabled for renderer process
- Context isolation enabled
- Web security enabled
- External URL navigation blocked (opens in default browser instead)
- Webview/iframe attachment blocked
- File:// protocol URLs restricted to app files

**Input Validation:**
- `assertSafeString()` validates prompt length (max 100,000 chars) and task type (max 32 chars)
- Settings values capped at 512 characters
- Whitelist of allowed setting keys prevents arbitrary credential storage

---

*Integration audit: 2026-04-20*
