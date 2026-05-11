// Playwright tool — generates and runs E2E tests for a scaffolded project.
// Writes test files to <projectRoot>/tests/e2e/ then executes them via
// `npx playwright test` (or the local binary if installed).

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, existsSync as fsExistsSync } from 'fs'
import { existsSync } from 'fs'
import { join } from 'path'
import { promisify as p } from 'util'

const execAsync = promisify(exec)
const writeAsync = p(writeFile)
const mkdirAsync = p(mkdir)

export interface PlaywrightTestCase {
  name: string
  code: string   // full test function body
}

export interface PlaywrightRunResult {
  ran: boolean
  passed: number
  failed: number
  skipped: number
  totalTests: number
  durationMs: number
  output: string
  error?: string
}

export interface PlaywrightResult {
  testsGenerated: number
  testFilePath: string
  runResult: PlaywrightRunResult
}

const PLAYWRIGHT_CONFIG = `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    headless: true,
    baseURL: 'http://localhost:5173'
  }
});
`

/**
 * Write generated test cases to disk and execute them.
 */
export async function runPlaywrightTests(
  projectRoot: string,
  testCases: PlaywrightTestCase[]
): Promise<PlaywrightResult> {
  if (!existsSync(projectRoot)) {
    return {
      testsGenerated: 0,
      testFilePath: '',
      runResult: { ran: false, passed: 0, failed: 0, skipped: 0, totalTests: 0, durationMs: 0, output: '', error: 'Project root not found' }
    }
  }

  const testDir = join(projectRoot, 'tests', 'e2e')
  await mkdirAsync(testDir, { recursive: true })

  // Write playwright config if not present
  const configPath = join(projectRoot, 'playwright.config.ts')
  if (!existsSync(configPath)) {
    await writeAsync(configPath, PLAYWRIGHT_CONFIG, 'utf8')
  }

  // Build the test file
  const testContent = buildTestFile(testCases)
  const testFilePath = join(testDir, 'app.spec.ts')
  await writeAsync(testFilePath, testContent, 'utf8')

  const runResult = await executeTests(projectRoot)

  return {
    testsGenerated: testCases.length,
    testFilePath,
    runResult
  }
}

function buildTestFile(cases: PlaywrightTestCase[]): string {
  const imports = `import { test, expect } from '@playwright/test';\n\n`
  const tests = cases.map((c) =>
    `test(${JSON.stringify(c.name)}, async ({ page }) => {\n${c.code}\n});\n`
  ).join('\n')
  return imports + tests
}

async function executeTests(projectRoot: string): Promise<PlaywrightRunResult> {
  const start = Date.now()
  try {
    const { stdout, stderr } = await execAsync(
      'npx playwright test --reporter=json 2>/dev/null || npx playwright test --reporter=line',
      { cwd: projectRoot, timeout: 120_000 }
    )
    const durationMs = Date.now() - start
    return parsePlaywrightOutput(stdout + stderr, durationMs)
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string }
    const durationMs = Date.now() - start
    const output = (execErr.stdout ?? '') + (execErr.stderr ?? '')
    if (output.includes('passed') || output.includes('failed')) {
      return parsePlaywrightOutput(output, durationMs)
    }
    return {
      ran: false, passed: 0, failed: 0, skipped: 0, totalTests: 0,
      durationMs,
      output: output.slice(0, 1000),
      error: execErr.message ?? 'playwright test failed to run'
    }
  }
}

function parsePlaywrightOutput(raw: string, durationMs: number): PlaywrightRunResult {
  // Try JSON reporter output first
  try {
    const jsonMatch = raw.match(/\{[\s\S]*"suites"[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      const stats = data.stats ?? {}
      return {
        ran: true,
        passed:  stats.expected ?? 0,
        failed:  stats.unexpected ?? 0,
        skipped: stats.skipped ?? 0,
        totalTests: (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.skipped ?? 0),
        durationMs,
        output: raw.slice(0, 2000)
      }
    }
  } catch { /* fall through to line parsing */ }

  // Line reporter fallback
  const passedMatch = raw.match(/(\d+)\s+passed/)
  const failedMatch = raw.match(/(\d+)\s+failed/)
  const skippedMatch = raw.match(/(\d+)\s+skipped/)
  const passed  = passedMatch  ? parseInt(passedMatch[1])  : 0
  const failed  = failedMatch  ? parseInt(failedMatch[1])  : 0
  const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0

  return {
    ran: true,
    passed, failed, skipped,
    totalTests: passed + failed + skipped,
    durationMs,
    output: raw.slice(0, 2000)
  }
}
