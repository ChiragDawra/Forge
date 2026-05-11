// Project state loader — detects which phases have already been completed
// by checking for their output artefacts on disk.
// Called when the renderer loads an existing project so it can skip
// already-completed phases and resume from the right point.

import { readFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { projectRoot, listProjectTree } from '../tools/filesystem'
import type {
  IntakeJson,
  PlanningResult,
  DesignResult,
  ScaffoldResult,
  CodegenResult,
  ReviewReport,
  SecurityReport,
  TestingReport,
  DeployReport
} from '../../preload/index.d'

export interface ProjectPhaseState {
  intake:    IntakeJson | null
  planning:  { prd: string; architectureRaw: string } | null
  design:    { brief: string; componentsRaw: string } | null
  scaffold:  { slug: string; filesCreated: number } | null
  // Phases 4-8: full reports when available, else null
  codegenResult:  CodegenResult | null
  reviewReport:   ReviewReport | null
  securityReport: SecurityReport | null
  testingReport:  TestingReport | null
  deployReport:   DeployReport | null
  // Convenience flags
  codegenDone:  boolean
  reviewDone:   boolean
  securityDone: boolean
  testingDone:  boolean
  deployDone:   boolean
}

function tryParse<T>(raw: PromiseSettledResult<string>): T | null {
  if (raw.status !== 'fulfilled') return null
  try { return JSON.parse(raw.value) as T } catch { return null }
}

/**
 * Probe disk artefacts for a project and return which phases are complete.
 * All reads are best-effort — missing files just return null/false.
 */
export async function loadProjectPhaseState(projectId: string): Promise<ProjectPhaseState> {
  const dir = join(app.getPath('userData'), 'projects', projectId)

  const [
    intakeRaw, prdRaw, archRaw, briefRaw, compRaw,
    codegenRaw, reviewRaw, securityRaw, testingRaw, deployRaw
  ] = await Promise.allSettled([
    readFile(join(dir, 'intake.json'),          'utf8'),
    readFile(join(dir, 'prd.md'),               'utf8'),
    readFile(join(dir, 'architecture.json'),    'utf8'),
    readFile(join(dir, 'design-brief.md'),      'utf8'),
    readFile(join(dir, 'ui-components.json'),   'utf8'),
    readFile(join(dir, 'codegen-report.json'),  'utf8'),
    readFile(join(dir, 'review-report.json'),   'utf8'),
    readFile(join(dir, 'security-report.json'), 'utf8'),
    readFile(join(dir, 'testing-report.json'),  'utf8'),
    readFile(join(dir, 'deploy-report.json'),   'utf8')
  ])

  // ── Intake ──────────────────────────────────────────────────────────
  const intake = tryParse<IntakeJson>(intakeRaw)

  // ── Planning ─────────────────────────────────────────────────────────
  let planning: { prd: string; architectureRaw: string } | null = null
  if (prdRaw.status === 'fulfilled' && archRaw.status === 'fulfilled') {
    planning = { prd: prdRaw.value, architectureRaw: archRaw.value }
  }

  // ── Design ───────────────────────────────────────────────────────────
  let design: { brief: string; componentsRaw: string } | null = null
  if (briefRaw.status === 'fulfilled' && compRaw.status === 'fulfilled') {
    design = { brief: briefRaw.value, componentsRaw: compRaw.value }
  }

  // ── Scaffold ─────────────────────────────────────────────────────────
  let scaffold: { slug: string; filesCreated: number } | null = null
  if (compRaw.status === 'fulfilled' && planning) {
    try {
      const arch = JSON.parse(planning.architectureRaw)
      const slug = arch?.projectName
        ? arch.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
        : projectId.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const root = projectRoot(slug)
      const tree = await listProjectTree(root, 1).catch(() => [])
      if (tree.length > 0) {
        scaffold = { slug, filesCreated: tree.filter((e) => e.type === 'file').length }
      }
    } catch { /* can't derive scaffold */ }
  }

  // ── Phase 4-8 reports ────────────────────────────────────────────────
  const codegenResult  = tryParse<CodegenResult>(codegenRaw)
  const reviewReport   = tryParse<ReviewReport>(reviewRaw)
  const securityReport = tryParse<SecurityReport>(securityRaw)
  const testingReport  = tryParse<TestingReport>(testingRaw)
  const deployReport   = tryParse<DeployReport>(deployRaw)

  return {
    intake,
    planning,
    design,
    scaffold,
    codegenResult,
    reviewReport,
    securityReport,
    testingReport,
    deployReport,
    codegenDone:  codegenRaw.status  === 'fulfilled',
    reviewDone:   reviewRaw.status   === 'fulfilled',
    securityDone: securityRaw.status === 'fulfilled',
    testingDone:  testingRaw.status  === 'fulfilled',
    deployDone:   deployRaw.status   === 'fulfilled'
  }
}

/**
 * Determine which phase index to resume from based on completed artefacts.
 */
export function resumePhaseIndex(state: ProjectPhaseState): number {
  if (state.deployDone)   return 9   // all done
  if (state.testingDone)  return 8
  if (state.securityDone) return 7
  if (state.reviewDone)   return 6
  if (state.codegenDone)  return 5
  if (state.scaffold)     return 4
  if (state.design)       return 3
  if (state.planning)     return 2
  if (state.intake)       return 1
  return 0
}
