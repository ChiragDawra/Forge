# Codebase Concerns

**Analysis Date:** 2026-04-20

## Tech Debt

**Incomplete Phase Pipeline Implementation:**
- Issue: Project lifecycle management exists only partially. Phase table schema is defined in `src/main/db/schema.ts` but phase execution, phase routing, and phase status transitions are not implemented. The UI shows a placeholder ("Phase pipeline will appear here (Day 8+)" in `src/renderer/src/pages/Project.tsx` line 150).
- Files: `src/main/db/schema.ts`, `src/renderer/src/pages/Project.tsx`
- Impact: Core feature (multi-phase AI generation pipeline) is incomplete. No way to execute individual phases or track progress through the 9-phase workflow (Intake → Planning → Design → Scaffold → Codegen → Review → Security → Testing → Deploy).
- Fix approach: Implement phase IPC handlers (create, list, update status), add phase routing in AI task handler to include phase context, populate Phase view in UI with phase execution controls and logs.

**Async Error Suppression in Settings:**
- Issue: `src/main/ipc/settings.ts` line 46 silently catches and ignores errors from `reinitAiClients()` when a user saves new API keys. The client reinit is non-blocking but errors are swallowed without logging or retry.
- Files: `src/main/ipc/settings.ts`
- Impact: If a user saves a key and the reinit fails, the new key won't take effect immediately. The user has no feedback that the reinit failed and may think the key was saved when it wasn't. Next call will fail with "client not initialised" error.
- Fix approach: Log the error (use existing `auditLog`) and consider adding a callback to notify renderer of init status, or attempt retry with exponential backoff.

**Timestamp Type Coercion in IPC Responses:**
- Issue: `src/main/ipc/projects.ts` lines 96-97 use a type guard that handles both Date and numeric timestamp values. This is necessary because Drizzle's aggregation functions return raw integers while direct selects return Date objects. The same pattern is replicated in `src/main/ipc/ai.ts` with the `toMillis()` utility.
- Files: `src/main/ipc/projects.ts`, `src/main/ipc/ai.ts` (lines 40-47)
- Impact: Type inconsistency creates fragility. Future developers may assume consistent behavior and break when aggregations are used. Manual conversion logic is error-prone (e.g., missing checks for invalid values).
- Fix approach: Normalize timestamps at the database layer by wrapping Drizzle queries in a helper that always returns milliseconds. Or enforce consistent return types in schema definitions via computed columns.

**Rate Limiting Not Tied to User:**
- Issue: `src/main/ipc/security.ts` implements per-channel rate limiting (20 calls/second) but does not differentiate between users. In a multi-user desktop app (e.g., shared machine), one user could exhaust the rate limit for all users.
- Files: `src/main/ipc/security.ts`
- Impact: DoS potential in shared environments. A malicious user or accidental loop in one process could starve legitimate requests.
- Fix approach: Include sender identification (e.g., Electron processId or OS user) in rate limit key. Consider per-user limits instead of per-channel global limits.

**IPC Sender Validation Limited to URL Origin:**
- Issue: `src/main/ipc/security.ts` line 39 only checks if the sender URL starts with `file://` or `http://localhost:`. Does not validate the actual frame hierarchy or parent window. A compromised local service running on localhost could spoof requests.
- Files: `src/main/ipc/security.ts` (lines 32-42)
- Impact: Medium risk. Prevents external attacks but not local exploits. Does not stop frame injection or iframe spoofing from trusted origins.
- Fix approach: Add sender frame validation (check `event.senderFrame.parent === null` for main frame only). Log and alert on suspicious patterns. Consider implementing a signed token exchange.

## Known Bugs

**Timestamp Zone Mismatch in Daily Usage Query:**
- Issue: `src/main/ipc/ai.ts` line 151 uses `strftime('%Y-%m-%d', ..., 'localtime')` to bucket usage by local time, but the comparison on line 163 uses `gte(modelUsage.calledAt, sinceDate)` where `sinceDate` is computed in JavaScript as `new Date(sinceMs)`. JavaScript Date assumes UTC; the SQL function uses local time. Result: Records near midnight UTC may be in wrong bucket or excluded depending on local timezone.
- Files: `src/main/ipc/ai.ts` (lines 140-177)
- Impact: Usage charts show incorrect daily buckets for non-UTC timezones, especially around day boundaries. Cosmetic but confusing for users.
- Trigger: Run on non-UTC timezone, generate usage near midnight UTC, check daily usage chart.
- Workaround: Convert `sinceDate` to local time in JavaScript using the system timezone offset before passing to SQL.

**Gemini Client Response Type Mismatch:**
- Issue: `src/main/ai/gemini.ts` line 28 accesses `response.usageMetadata?.candidatesTokenCount` but Google's API returns this as the count of output tokens in the _first candidate_, not total. If multiple candidates are generated, the count is incomplete.
- Files: `src/main/ai/gemini.ts`
- Impact: Cost tracking for Gemini is underestimated when the model generates multiple candidates. No observable user impact unless usage reports are audited against invoices.
- Trigger: Call Gemini with candidate_count > 1 (not exposed in current code, but possible via prompt injection into raw SDK).
- Workaround: Sum token counts across all candidates; check Gemini API docs for multi-candidate response structure.

## Security Considerations

**API Keys Stored in OS Keychain Without Verification:**
- Risk: `src/main/ipc/settings.ts` and `src/main/ai/init.ts` load API keys from keytar (OS keychain) at startup and reinit. If the keychain is compromised or the OS is hijacked, all keys are exposed. No validation that the key matches expected format (e.g., length, prefix).
- Files: `src/main/ipc/settings.ts`, `src/main/ai/init.ts`, `src/main/ai/claude-base.ts`, `src/main/ai/claude-opus.ts`, `src/main/ai/gemini.ts`
- Current mitigation: Relies on OS keychain security (good), but no app-level validation.
- Recommendations: (1) Validate key format before use (e.g., Anthropic keys start with `sk-ant-`). (2) Catch and safely handle MalformedKeyError from API clients. (3) Store a salted hash of the key in the local DB to detect tampering. (4) Implement key rotation / expiration warnings.

**Prompt Injection via Project Name and Prompt Fields:**
- Risk: `src/main/ipc/projects.ts` accepts user input in `name` and `prompt` fields. These are stored in DB and can be passed to AI models. If the `prompt` field is used verbatim in AI calls without sanitization, a user could inject instructions that override the task intent.
- Files: `src/main/ipc/projects.ts` (lines 29-56), `src/renderer/src/pages/Project.tsx` (line 81)
- Current mitigation: Input validation in `assertSafeString()` checks length and control characters but not semantic injection.
- Recommendations: (1) Sanitize `prompt` before passing to AI models—wrap in explicit delimiters (e.g., `<USER_PROMPT>...</USER_PROMPT>`). (2) Never pass user-provided `name` as part of the AI prompt. (3) Add logging of all prompts sent to models for audit trail. (4) Document that user prompts are logged (privacy/security disclosure).

**Error Messages Leak Internal State:**
- Risk: `src/main/ipc/security.ts` `safeErrorMessage()` filters certain error messages but the logic is brittle. Errors containing substrings like "invalid" or "unauthorized" are passed through. A new error type added by a developer could leak internals.
- Files: `src/main/ipc/security.ts` (lines 71-86)
- Current mitigation: Whitelist approach on substring matching.
- Recommendations: (1) Use a structured error code system instead of string matching. (2) Log full error to audit log; return only generic message to client. (3) Add an ErrorCode enum (e.g., `ERR_RATE_LIMIT`, `ERR_INVALID_INPUT`) and map to user-facing messages.

**CSP Policy Not Enforced in Development:**
- Risk: `src/main/index.ts` lines 76-79 disable Content-Security-Policy in development mode to allow Vite HMR. Development builds used locally can be accidentally released with weak CSP.
- Files: `src/main/index.ts`
- Current mitigation: Explicitly conditional on `is.dev`.
- Recommendations: (1) Ensure build process always sets `NODE_ENV=production` when packaging. (2) Add a startup check that logs a warning if CSP is weak and the app binary is signed (production-like). (3) Test production build with CSP enabled before release.

## Performance Bottlenecks

**Daily Usage Query Groups All Records:**
- Problem: `src/main/ipc/ai.ts` lines 153-164 fetch and group all model_usage records within the lookback window, even if the user has thousands of calls. No pagination, no limit on results.
- Files: `src/main/ipc/ai.ts`
- Cause: SQL aggregation groups by date and model, which is efficient, but the result set grows linearly with the number of models × days. Chart component renders all 7 days by default; no way to paginate or limit.
- Improvement path: (1) Add `LIMIT` on the aggregation (e.g., 180 records). (2) Cache results for N minutes to avoid re-aggregating on every page view. (3) Add pagination or time-range controls in the UI to let users drill down.

**SVG Chart Re-renders Full DOM on Data Change:**
- Problem: `src/renderer/src/components/usage/UsageChart.tsx` rebuilds the entire SVG (lines 102-180) inside a `useMemo` but the memoization key includes `[rows, days, metric]` and rows are replaced on every API call even if data unchanged.
- Files: `src/renderer/src/components/usage/UsageChart.tsx`
- Cause: `Models.tsx` calls `usageSummary()` on every refresh, which returns new array references even if the DB data is identical. No deduplication at fetch layer.
- Improvement path: (1) Implement client-side caching in `Models.tsx`—only re-fetch if > 5min since last fetch. (2) Add data deduplication at IPC layer (compare hash of results). (3) Memoize or virtualize large SVG charts if rendering > 100 bars.

**Unindexed Queries on Phase Logs:**
- Problem: `src/main/db/schema.ts` defines `phaseLogs` table with `phaseId` foreign key but no index on `phaseId`. Fetching logs for a phase will scan the entire table.
- Files: `src/main/db/schema.ts` (lines 24-32)
- Cause: Phase feature is not yet implemented; index forgotten during schema design.
- Improvement path: Add index `idx_phase_logs_phase_id` on `phaseId` before implementing phase log retrieval queries.

## Fragile Areas

**Zustand Store Without Invalidation:**
- Files: `src/renderer/src/lib/stores/projects.ts`
- Why fragile: The `useProjectsStore` has a `fetch()` method that loads projects but no way to invalidate cache or subscribe to remote updates. If a project is created in one window and viewed in another, the store will be stale. No error handling for failed fetches (line 31 logs error but does not retry).
- Safe modification: (1) Use React Query instead of Zustand for remote data—built-in caching, invalidation, and retries. (2) Add a `refresh()` method that force-fetches. (3) Implement a heartbeat timer that refetches every N seconds. (4) Add error state with retry button.
- Test coverage: No tests. Add integration test that fetches, creates, and refetches to verify list includes new project.

**Timestamp Conversion Logic Scattered:**
- Files: `src/main/ipc/projects.ts`, `src/main/ipc/ai.ts` (toMillis function)
- Why fragile: Two different timestamp conversion patterns exist. The `toMillis()` helper in `ai.ts` handles `Date | number | null` but the logic in `projects.ts` line 96 is inline. If a third layer needs timestamps, the pattern may not be replicated correctly.
- Safe modification: Extract shared `src/main/ipc/timestamp-utils.ts` with `toMillis()`, `toDate()`, and timestamp type guards. Use everywhere.
- Test coverage: Add unit tests for edge cases (invalid numbers, very large numbers, null values).

**Hard-Coded Model Names Across Multiple Layers:**
- Files: `src/main/ai/router.ts`, `src/main/ai/claude-base.ts`, `src/main/ai/claude-opus.ts`, `src/main/ai/gemini.ts`, `src/renderer/src/lib/constants.ts`
- Why fragile: Model identifiers are hard-coded strings in 5+ places. Renaming a model requires touching many files. No single source of truth.
- Safe modification: (1) Move all model definitions to a centralized enum in `src/main/ai/models.ts`. (2) Export and re-export from `src/renderer/src/lib/constants.ts` to avoid duplication. (3) Add a sync check in CI that verifies renderer constants match backend models.ts.
- Test coverage: Add test that imports models from both layers and asserts they match.

**IPC Error Handling Inconsistent:**
- Files: All IPC handlers in `src/main/ipc/`
- Why fragile: Each handler wraps its logic in try-catch and calls `safeErrorMessage()`. But the error handling pattern is repetitive (lines 50-56 in projects.ts are identical to ai.ts lines 60-72). If the pattern needs to change, all handlers must be updated.
- Safe modification: Extract a generic `ipcHandler()` wrapper that takes a channel name and async function, handles try-catch, validation, and error messages.
- Test coverage: Add test that verifies all IPC errors are logged and returned with consistent structure.

## Scaling Limits

**SQLite Single-Writer Bottleneck:**
- Current capacity: SQLite with WAL mode handles concurrent reads but only one writer. With the Models dashboard polling `ai:total-cost` every page view, concurrent usage queries will queue.
- Limit: When usage recording reaches ~100 calls/second, writes will start blocking reads. Chart queries will timeout.
- Scaling path: (1) For single-user Electron app, this is unlikely. (2) If Forge evolves to multi-user or server-side, migrate to PostgreSQL with connection pooling. (3) In the meantime, add write batching—collect usage records in memory and flush every 5 seconds.

**Keychain Access Blocks App Startup:**
- Current capacity: `src/main/ai/init.ts` loads 3 keys from keytar at startup. Each call is blocking (though wrapped in Promise.all). On Windows with slow keytar, startup can take 5+ seconds.
- Limit: If keys grow to 10+, startup becomes noticeably slow.
- Scaling path: (1) Make key loading truly non-blocking with error boundaries. (2) Cache key existence/invalidity in localStorage so init doesn't call keytar on every startup. (3) Lazy-load keys on first use instead of at startup.

## Dependencies at Risk

**Electron Dependency Specific to Major Version:**
- Risk: `package.json` pins `electron: ^33.4.11`. Major version 33 may have breaking changes in 34. Preload module location, context isolation API, or native module compatibility could change.
- Impact: Breaking change in major Electron version could require code rewrites (e.g., preload schema changes, renderer IPC API changes).
- Migration plan: (1) Review Electron release notes before upgrading major version. (2) Test against beta releases early. (3) Pin minor version in CI and only bump on intentional release cycles.

**better-sqlite3 Native Module Binding:**
- Risk: `better-sqlite3@^12.8.0` requires native compilation for each Node.js + OS + Arch combination. Changes in Electron's bundled Node.js version could require rebuilding (handled by `@electron/rebuild` in build scripts).
- Impact: If Electron updates its Node.js and native module compilation fails, the app will not start and users will see "sqlite3.node not found" errors.
- Migration plan: (1) Test app build and startup after every Electron minor bump. (2) Pin Node.js version in CI matching Electron's bundled version. (3) Have a fallback plan to use `sql.js` (pure JS SQLite) if native issues arise.

**Google Generative AI SDK Interface:**
- Risk: `@google/generative-ai@^0.24.0` is beta. API may change in next major version (response format, token counting method, etc.).
- Impact: If Google GA releases v1.0 with breaking changes, usage tracking and content extraction could break.
- Migration plan: (1) Lock to exact version `0.24.0` until SDK stabilizes (GA release). (2) Add a test that validates token count structure against expected schema. (3) Implement fallback cost calculation if token metadata is missing.

**Keytar Library Availability:**
- Risk: `keytar@^7.9.0` may not be available on all platforms or keychain implementations. Windows Credential Manager, macOS Keychain, and Linux Secret Service have different reliability.
- Impact: On misconfigured Linux systems (no Secret Service daemon), API key save/load will fail silently, and users will see "not initialised" errors without understanding why.
- Migration plan: (1) Add platform-specific tests in CI (mock keytar on Linux if unavailable). (2) Implement fallback: if keytar fails, warn user and suggest manual key entry. (3) Log detailed error on keytar failure (service name, platform, error code) for debugging.

## Missing Critical Features

**Phase Execution Pipeline Not Implemented:**
- Problem: The entire phase orchestration system is stubbed out. No way to transition a project from "pending" to "running", execute each phase, or track progress.
- Blocks: (1) Generating multi-phase code (can only call AI once manually). (2) Tracking phase status and logs. (3) Building apps with structured workflows. (4) All planned Day 8+ features.
- Implementation outline: (1) Add phase IPC handlers (create, list, update, delete). (2) Implement phase executor that routes tasks to AI by phase type. (3) Add phase log storage and retrieval. (4) Build UI to show phase timeline and logs.

**Error Recovery / Retry Logic Minimal:**
- Problem: Most async operations (IPC calls, API calls, DB writes) have no retry or fallback. A transient network error kills the entire operation.
- Blocks: Reliable operation in flaky networks (mobile, unstable WiFi). Building resilient batch operations (multi-phase generation).
- Implementation outline: (1) Implement exponential backoff for API calls. (2) Batch DB writes with rollback on failure. (3) Add user-facing "retry" buttons for failed operations. (4) Implement operation resumption (save state, resume from last checkpoint).

**Offline Mode / Data Sync:**
- Problem: App requires live API keys and network connectivity to function. No offline fallback or local-first capability.
- Blocks: Using Forge on plane, train, or with unreliable internet. Syncing projects across devices.
- Implementation outline: (1) Cache API responses locally. (2) Queue operations when offline, sync on reconnect. (3) Implement local-first data model with eventual consistency. (4) Use CRDTs or operational transform for multi-device sync.

## Test Coverage Gaps

**No Unit Tests for IPC Security:**
- What's not tested: Rate limiting behavior, sender validation, input sanitization, error message filtering.
- Files: `src/main/ipc/security.ts`, all `src/main/ipc/*.ts` handlers
- Risk: Changes to security logic could introduce vulnerabilities without detection. New developers may add handlers that bypass validation.
- Priority: High — security-critical code must be tested.
- Implementation: Add `src/main/ipc/__tests__/security.test.ts` with tests for: (1) rate limit enforcement, (2) sender frame validation, (3) string sanitization edge cases, (4) error message filtering.

**No Integration Tests for AI Model Routing:**
- What's not tested: Correct model is called for each task type, cost calculation is accurate, usage logging doesn't crash on errors.
- Files: `src/main/ai/router.ts`, `src/main/ai/types.ts`, all `claude-*.ts` and `gemini.ts`
- Risk: Renaming models or changing cost tables could break silently. Logging failures could cause API calls to fail.
- Priority: Medium — used on every AI call, but simple logic. Add once phase execution is implemented (will make it easy to test multi-phase workflows).
- Implementation: Add `src/main/ai/__tests__/router.test.ts` with mocked API clients that validate: (1) task → model mapping, (2) cost formula, (3) logging on success and error.

**No E2E Tests for Core Workflows:**
- What's not tested: Creating a project, calling an AI model, viewing usage stats, updating API keys.
- Files: All critical paths
- Risk: UI changes could break IPC calls without detection. Regressions in core workflows are caught only by manual testing.
- Priority: High — core user workflows must work end-to-end.
- Implementation: Add e2e tests using Playwright or Electron's built-in testing harness: (1) launch app, (2) set API keys, (3) create project, (4) trigger AI call, (5) verify cost is tracked, (6) check Models page shows usage.

**No Tests for Timestamp Handling:**
- What's not tested: Timezone edge cases, Drizzle type coercion, SQL aggregation timestamp values.
- Files: `src/main/ipc/ai.ts`, `src/main/ipc/projects.ts`
- Risk: Daylight saving time transitions, timezone mismatches, and leap seconds could cause usage charts to be off by a day in specific scenarios.
- Priority: Medium — cosmetic but confusing.
- Implementation: Add `src/main/ipc/__tests__/timestamps.test.ts` with tests for: (1) creating records near midnight, (2) verifying aggregation groups by local date, (3) validating toMillis() with edge cases.

---

*Concerns audit: 2026-04-20*
