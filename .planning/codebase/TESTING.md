# Testing Patterns

**Analysis Date:** 2026-04-20

## Test Framework

**Runner:**
- Not configured - no test framework detected in project
- No Jest, Vitest, or other test runner dependencies in `package.json`

**Assertion Library:**
- Not applicable - no testing framework installed

**Run Commands:**
```bash
# No test command available in package.json
# Testing infrastructure not currently set up
```

## Test File Organization

**Location:**
- No test files found in codebase
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files detected
- No separate `__tests__` directories

**Naming:**
- When testing is implemented, follow pattern: `[file].test.ts` or `[file].spec.ts`
- Recommended: co-locate tests with source files for ease of discovery

**Structure:**
- Recommendation: organize by feature/module, not by test type

## Test Structure

**Suite Organization:**
- No test suites currently implemented
- Recommendation when implementing: group related tests using describe blocks

**Patterns:**
- Once testing is introduced, follow AAA pattern (Arrange, Act, Assert) recommended
- Setup and teardown hooks if needed for database operations or state reset

## Mocking

**Framework:**
- When testing framework is chosen, consider using Jest's built-in mocking or Vitest mocks

**Patterns:**
- No mocking patterns established yet

**What to Mock:**
- Electron IPC calls (`ipcRenderer.invoke`) should be mocked in component/React tests
- Database calls should be mocked or use in-memory SQLite for integration tests
- External API calls (Anthropic SDK, Google Generative AI) should be mocked
- FileSystem operations should be mocked in unit tests

**What NOT to Mock:**
- Core business logic (computeCost, formatters)
- Type guards and utility functions
- Date/time operations if testing time-sensitive code (use fake timers instead)

## Fixtures and Factories

**Test Data:**
- No fixtures or factories currently in codebase
- Recommendation when implementing:
  - Create factory functions for `ModelResponse`, `ProjectRow`, `UsageSummaryRow` objects
  - Store in `src/__tests__/fixtures/` or similar

**Location:**
- Recommendation: `src/__tests__/fixtures/` for shared test data
- Or `src/__tests__/factories/` for factory functions

## Coverage

**Requirements:**
- No coverage requirements enforced
- No coverage thresholds in configuration

**View Coverage:**
- Once testing is implemented, add to package.json:
```bash
npm run test:coverage
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions and components
- **Approach:**
  - Test formatting functions in `src/renderer/src/lib/format.ts` independently
  - Test cost calculation in `src/main/ai/types.ts` with various token counts
  - Test utility functions like `cn()` with different class values
  - Test Zustand store state changes and async operations
  - Test IPC handlers by mocking Electron events and database

**Example areas to test:**
- `formatCost(usd)` with edge cases: 0, negative, very small, very large numbers
- `formatTokens(n)` with various token counts (single digit, thousands, millions)
- `formatRelativeTime(ms)` with past, future, and null inputs
- `computeCost(model, inputTokens, outputTokens)` with different models
- Component rendering with different props
- State management in `useProjectsStore`

**Integration Tests:**
- **Scope:** IPC communication, database operations, multi-component flows
- **Approach:**
  - Test IPC handlers with real database (use test database file)
  - Test error handling and validation in security module
  - Test rate limiting behavior across multiple calls
  - Test project creation flow (from renderer request through database to response)
  - Test usage tracking and aggregation queries

**E2E Tests:**
- **Framework:** Not currently used
- **Recommendation:** Consider Playwright or Electron's built-in testing capabilities if needed
- **Scope would be:** Full application flows from UI interaction through data persistence

## Common Patterns

**Async Testing:**
- Current codebase has async/await throughout
- When testing async functions, ensure test is marked async or returns Promise
- For setTimeout/setInterval (as in rate limiter), use Jest's `jest.useFakeTimers()` or Vitest equivalent

**Example pattern:**
```typescript
test('checkRateLimit allows calls under threshold', () => {
  // Call checkRateLimit 20 times should succeed
  for (let i = 0; i < 20; i++) {
    expect(() => checkRateLimit('test-channel')).not.toThrow()
  }
  
  // 21st call should throw
  expect(() => checkRateLimit('test-channel')).toThrow('Rate limit exceeded')
})

test('rate limit resets after 1 second', () => {
  jest.useFakeTimers()
  
  checkRateLimit('test-channel')
  jest.advanceTimersByTime(1000)
  expect(() => checkRateLimit('test-channel')).not.toThrow()
  
  jest.useRealTimers()
})
```

**Error Testing:**
- Components gracefully handle missing APIs:
```typescript
test('Header shows zero cost when API unavailable', () => {
  // Mock window.api as undefined
  const original = window.api
  delete (window as any).api
  
  render(<Header />)
  expect(screen.getByText('$0.00')).toBeInTheDocument()
  
  window.api = original
})
```

- IPC handlers return safe error messages:
```typescript
test('IPC handler returns safe error message on unknown error', async () => {
  const dbError = new Error('Database connection failed')
  getDb.mockImplementation(() => {
    throw dbError
  })
  
  const event = createMockIpcEvent()
  await expect(
    ipcHandlers['ai:call'](event, 'some-task', 'prompt')
  ).rejects.toThrow('An unexpected error occurred')
})
```

## Testing Priorities

**High Priority (core logic):**
- Cost calculation (`computeCost` function) - financial accuracy critical
- Rate limiting (`checkRateLimit`) - prevents abuse
- Input validation (`assertSafeString`) - security boundary
- Usage tracking and aggregation - business intelligence critical

**Medium Priority (features):**
- IPC handlers for projects and AI calls
- Store operations (fetch, create project)
- Component rendering with different data states
- Date formatting for relative time display

**Low Priority (UI):**
- Layout components styling
- Icon selection in components
- Tailwind class composition

---

*Testing analysis: 2026-04-20*
