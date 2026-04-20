# Coding Conventions

**Analysis Date:** 2026-04-20

## Naming Patterns

**Files:**
- Components: PascalCase, e.g., `UsageCard.tsx`, `ModelBadge.tsx`
- Utilities: camelCase, e.g., `utils.ts`, `format.ts`
- Stores: camelCase with "store" suffix, e.g., `projects.ts`
- Modules: camelCase, e.g., `client.ts`, `schema.ts`
- IPC handlers: camelCase with domain prefix, e.g., `ai.ts`, `projects.ts`, `settings.ts`

**Functions:**
- React components: PascalCase, exported as default, e.g., `export default function UsageCard() { }`
- Utility functions: camelCase, exported as named exports, e.g., `export function formatCost()`
- Private functions: camelCase with leading underscore for module-level state, e.g., `let _client: Anthropic | null = null`
- Handler functions: camelCase, e.g., `checkRateLimit()`, `validateSender()`

**Variables:**
- Constants: UPPER_SNAKE_CASE for global constants, e.g., `MODEL`, `MAX_CALLS_PER_SECOND`, `CLEANUP_INTERVAL_MS`
- State/data: camelCase, e.g., `callLog`, `costLabel`, `totalTokens`
- Types/interfaces: PascalCase, e.g., `ProjectsState`, `ModelResponse`, `UsageCardProps`
- Enums/mappings: UPPER_SNAKE_CASE or PascalCase depending on whether they're static values, e.g., `MODEL_LABELS`, `PROJECT_STATUS`

**Types:**
- Interfaces for component props: `[ComponentName]Props`, e.g., `UsageCardProps`
- Interfaces for state: `[EntityName]State`, e.g., `ProjectsState`
- Type unions for discriminated types: PascalCase, e.g., `ModelName`, `TaskType`
- Database row types: `[TableName]Row`, e.g., `UsageSummaryRow`, `ProjectRow`, `DailyUsageRow`

## Code Style

**Formatting:**
- No explicit formatter configured (ESLint/Prettier not found in project root)
- 2-space indentation (inferred from codebase)
- Single quotes for strings where possible
- Semicolons present on all statements
- No trailing commas in multiline objects/arrays (observed pattern)

**Linting:**
- No ESLint configuration found
- TypeScript strict mode enabled via inherited `@electron-toolkit/tsconfig` config
- Type safety enforced through TypeScript compiler

## Import Organization

**Order:**
1. External packages (`import { ... } from 'package-name'`)
2. Absolute path imports using aliases (`import { ... } from '@renderer/...'`)
3. Relative imports for local modules (`import { ... } from '../../../../preload/...'`)
4. Type imports grouped at top with other imports (`import type { ... } from '...'`)

**Path Aliases:**
- `@renderer/*` → `src/renderer/src/*` (web app code)
- `@/*` → `src/renderer/src/*` (alternative alias for web app)
- Electron main process uses relative imports
- Preload uses relative imports with explicit `index.d` imports

**Examples:**
```typescript
// Correct import order in src/renderer/src/components/usage/UsageCard.tsx
import { BarChart3, Cpu, Clock } from 'lucide-react'  // External
import { MODEL_COSTS, type ModelName } from '@renderer/lib/constants'  // Alias
import { formatCost, formatTokens, formatRelativeTime } from '@renderer/lib/format'  // Alias
import type { UsageSummaryRow } from '../../../../preload/index.d'  // Relative type import
```

## Error Handling

**Patterns:**
- Try-catch blocks on async IPC handlers with explicit error messages
- Rate limiting and validation checks before business logic
- Graceful degradation when APIs are unavailable (check `typeof window.api?.projects`)
- Silent failure for non-critical operations (usage logging wraps in try-catch with console.warn)
- Safe error message filtering in IPC (return generic message or predefined messages only)
- Early returns with null for optional operations, e.g., `if (!hasApi()) return null`

**Example from src/main/ipc/ai.ts:**
```typescript
try {
  validateSender(event)
  checkRateLimit('ai:call')
  assertSafeString(taskType, 'taskType', 32)
  // Business logic
} catch (err) {
  auditLog('ai:call:error', safeErrorMessage(err))
  throw new Error(safeErrorMessage(err))
}
```

**Example from src/main/ai/types.ts:**
```typescript
try {
  // Log usage to DB
  await db.insert(modelUsage).values({ ... })
} catch (err) {
  // Log warning but never crash the caller for a usage-tracking failure
  console.warn('[AI] Failed to log usage:', err instanceof Error ? err.message : err)
}
```

## Logging

**Framework:** `console` (no external logging library)

**Patterns:**
- `console.error()` for startup failures (DB init)
- `console.warn()` for non-critical failures (usage tracking)
- `console.log()` for audit events with `[AUDIT]` prefix
- Conditional logging based on environment (`is.dev`)
- Prefix logs with module name in brackets, e.g., `[AI]`, `[Forge]`, `[AUDIT]`

**Examples:**
```typescript
console.error('[Forge] DB init failed:', err)
console.warn('[AI] Failed to log usage:', err instanceof Error ? err.message : err)
console.log(`[AUDIT] ${ts} ${action}: ${detail}`)
```

## Comments

**When to Comment:**
- Section headers for logical groupings using dashed lines: `// ─── Rate limiter ────────────────────────────────────────────`
- Inline comments for non-obvious security or performance rationale
- Comments above complex functions explaining "why" not "what"

**JSDoc/TSDoc:**
- No JSDoc usage observed
- Self-documenting code preferred (clear names, type signatures)
- Comments used only where intent isn't obvious from code

**Example from src/main/ipc/ai.ts:**
```typescript
// Drizzle's timestamp mode stores unix seconds; direct selects give Date,
// but aggregations (max, min) and raw SQL give the raw integer. Normalise.
function toMillis(v: unknown): number | null { ... }
```

**Example section header from src/main/ipc/security.ts:**
```typescript
// ─── Rate limiter ────────────────────────────────────────────
```

## Function Design

**Size:** Functions kept small and focused (median ~20-30 lines for utility functions, IPC handlers ~30-40 lines with validation)

**Parameters:**
- Functions typically 0-3 parameters
- Complex options passed as object parameter: `opts: CallOptions = {}`
- Destructuring in function signatures for component props: `{ label, modelId, usage }`
- Default parameters used for optional values: `opts: CallOptions = {}`

**Return Values:**
- Explicit return types on all functions: `Promise<UsageSummaryRow[]>`, `React.JSX.Element`
- Nullable return types when operation might fail: `Promise<ProjectRow | null>`
- Void for side-effect functions: `void`
- Type predicates for narrowing: `(b): b is Anthropic.TextBlock => b.type === 'text'`

**Examples:**
```typescript
// src/main/ai/claude-base.ts
export async function callClaudeBase(
  prompt: string,
  opts: CallOptions = {}
): Promise<ModelResponse> { ... }

// src/renderer/src/components/usage/UsageCard.tsx
export default function UsageCard({ label, modelId, usage }: UsageCardProps): React.JSX.Element { ... }

// src/renderer/src/lib/format.ts
export function formatCost(usd: number): string { ... }
```

## Module Design

**Exports:**
- Components exported as default export: `export default function ComponentName() { }`
- Utilities exported as named exports: `export function utilityName() { }`
- Zustand stores exported as named constant: `export const useProjectsStore = create<...>(...)`
- Types and interfaces exported as named: `export interface ModelResponse { }`

**Barrel Files:**
- Not used in this codebase (no `index.ts` files re-exporting multiple symbols)
- Imports prefer direct paths: `import { formatCost } from '@renderer/lib/format'`

**Module-Level State:**
- Minimal module-level state used
- Rate limit cache in `security.ts`: `const callLog = new Map()`
- Client instances stored as module-level private variables: `let _client: Anthropic | null = null`
- Initialization functions set up state: `initClaudeBase(apiKey)`, `initDb(userDataPath)`

**Example from src/renderer/src/lib/stores/projects.ts:**
```typescript
export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  fetch: async () => { ... },
  createProject: async (name: string, prompt: string) => { ... }
}))
```

---

*Convention analysis: 2026-04-20*
