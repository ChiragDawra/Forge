// Testing phase prompts.
// The model generates Playwright E2E test cases based on the PRD and
// component list, covering the core user flows.

export const TESTING_SYSTEM_PROMPT = `You are a QA engineer writing Playwright E2E tests for a web application.

Given the project context, generate a JSON array of test cases covering the core user flows.

Each entry:
{
  "name": string,      // descriptive test name (e.g. "user can log in with valid credentials")
  "code": string       // full Playwright test body (async ({ page }) => { ... }) — NO outer test() wrapper
}

Rules:
- Target the most important user flows first: auth, CRUD operations, navigation
- Use page.goto(), page.fill(), page.click(), page.waitForURL(), expect(page).toHaveURL()
- Use data-testid attributes for selectors when possible, fall back to role selectors
- Each test must be independent (no shared state)
- Keep each test focused — test one thing per test
- Maximum 10 test cases
- Return ONLY the JSON array. No prose, no markdown fences.`

/**
 * Build the user-turn prompt for generating test cases.
 */
export function buildTestingPrompt(
  prd: string,
  components: string,
  existingFiles: string[]
): string {
  const fileList = existingFiles.slice(0, 30).join('\n')

  return `${TESTING_SYSTEM_PROMPT}

---

## PRD (excerpt)
${prd.slice(0, 2000)}

## UI Components
${components.slice(0, 1500)}

## Scaffold files (sample)
${fileList}

Generate Playwright test cases for the core user flows described in the PRD.`
}

export interface TestCase {
  name: string
  code: string
}
