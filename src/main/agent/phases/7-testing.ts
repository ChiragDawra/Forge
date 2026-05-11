// Phase 7 — Playwright E2E testing.
// Generates test cases from the PRD + component list, writes them to
// the scaffold root, and runs them via Playwright CLI.
// Persists testing-report.json under project artefacts.

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { projectRoot, listProjectTree } from '../../tools/filesystem'
import { runPlaywrightTests, type PlaywrightRunResult } from '../../tools/playwright'
import { buildTestingPrompt, type TestCase } from '../prompts/testing'
import type { CallOptions } from '../../ai/types'

export interface TestingReport {
  testedAt: number
  testsGenerated: number
  testFilePath: string
  passed: number
  failed: number
  skipped: number
  totalTests: number
  durationMs: number
  playwrightRan: boolean
  output: string
  model: string
  totalCostUsd: number
}

export async function runTesting(
  projectId: string,
  scaffoldSlug: string,
  log: (msg: string) => void,
  opts: CallOptions = {}
): Promise<TestingReport> {
  const dir  = join(app.getPath('userData'), 'projects', projectId)
  const root = projectRoot(scaffoldSlug)

  // ── Load context ──────────────────────────────────────────────────────
  log('Loading project context for test generation…')
  const [prdRaw, compRaw] = await Promise.allSettled([
    readFile(join(dir, 'prd.md'), 'utf8'),
    readFile(join(dir, 'ui-components.json'), 'utf8')
  ])
  const prd   = prdRaw.status  === 'fulfilled' ? prdRaw.value  : ''
  const comps = compRaw.status === 'fulfilled' ? compRaw.value : '[]'

  let existingFiles: string[] = []
  try {
    const tree = await listProjectTree(root, 3)
    existingFiles = tree.filter((e) => e.type === 'file').map((e) => e.path)
  } catch { /* scaffold may not exist */ }

  // ── Generate test cases ───────────────────────────────────────────────
  log('Generating Playwright test cases…')
  const prompt = buildTestingPrompt(prd, comps, existingFiles)
  const response = await routeTask('testing', prompt, opts)
  await logUsage(response, opts)
  const totalCost = response.costUsd
  const model     = response.model

  const testCases = parseTestCases(response.content)
  log(`Generated ${testCases.length} test cases`)

  // ── Write + run tests ─────────────────────────────────────────────────
  log('Writing and running Playwright tests…')
  const { testsGenerated, testFilePath, runResult } = await runPlaywrightTests(root, testCases)

  if (runResult.ran) {
    log(`Playwright: ${runResult.passed} passed, ${runResult.failed} failed, ${runResult.skipped} skipped`)
  } else {
    log(`Playwright could not run: ${runResult.error ?? 'unknown error'}`)
    log('Test file written — run manually with: npx playwright test')
  }

  const report: TestingReport = {
    testedAt: Date.now(),
    testsGenerated,
    testFilePath,
    passed:     runResult.passed,
    failed:     runResult.failed,
    skipped:    runResult.skipped,
    totalTests: runResult.totalTests,
    durationMs: runResult.durationMs,
    playwrightRan: runResult.ran,
    output:     runResult.output,
    model,
    totalCostUsd: totalCost
  }

  const outPath = join(dir, 'testing-report.json')
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8')
  log(`Testing report saved to ${outPath}`)

  return report
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseTestCases(raw: string): TestCase[] {
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start < 0 || end < start) return []
  try {
    const arr = JSON.parse(raw.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (t): t is TestCase =>
        typeof t?.name === 'string' && t.name.trim() !== '' &&
        typeof t?.code === 'string' && t.code.trim() !== ''
    ).slice(0, 10)
  } catch {
    return []
  }
}
