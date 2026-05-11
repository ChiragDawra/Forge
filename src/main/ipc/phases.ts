// IPC for the phase pipeline.
// Phase 0 (intake): run → finalise → intake.json
// Phase 1 (planning): run → prd.md + architecture.json
// Later phases bolt on using the same shape.

import { ipcMain, app } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  runIntake,
  runFinalise,
  type IntakeDraft,
  type IntakeAnswer,
  type IntakeJson
} from '../agent/phases/0-intake'
import {
  runPlanning,
  type PlanningInput,
  type PlanningResult
} from '../agent/phases/1-planning'
import { runDesign, type DesignResult } from '../agent/phases/2-design'
import { runScaffold, type ScaffoldResult } from '../agent/phases/3-scaffold'
import { runCodegen, type CodegenResult } from '../agent/phases/4-codegen'
import { runReview, type ReviewReport } from '../agent/phases/5-review'
import { runSecurity, type SecurityReport } from '../agent/phases/6-security'
import { runTesting, type TestingReport } from '../agent/phases/7-testing'
import {
  validateSender,
  checkRateLimit,
  assertSafeString,
  safeErrorMessage,
  auditLog
} from './security'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function registerPhasesIpc(): void {
  // ── Phase 0: run intake model call ─────────────────────────────────
  ipcMain.handle(
    'phases:intake:run',
    async (event, rawIdea: unknown, projectId?: unknown): Promise<IntakeDraft> => {
      try {
        validateSender(event)
        checkRateLimit('phases:intake:run')
        assertSafeString(rawIdea, 'rawIdea', 10_000)

        const opts: { projectId?: string } = {}
        if (typeof projectId === 'string') {
          if (!UUID_RE.test(projectId)) throw new Error('projectId must be a UUID')
          opts.projectId = projectId
        }

        auditLog('phases:intake:run', `projectId=${opts.projectId ?? 'none'}`)
        return await runIntake(rawIdea as string, opts)
      } catch (err) {
        auditLog('phases:intake:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 0: finalise with user answers + persist intake.json ───────
  ipcMain.handle(
    'phases:intake:finalise',
    async (
      event,
      draft: unknown,
      answers: unknown,
      projectId?: unknown
    ): Promise<{ intake: IntakeJson; path: string }> => {
      try {
        validateSender(event)
        checkRateLimit('phases:intake:finalise')

        if (!isDraft(draft)) throw new Error('draft is malformed')
        if (!Array.isArray(answers)) throw new Error('answers must be an array')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }

        const safeAnswers: IntakeAnswer[] = []
        for (const a of answers.slice(0, 20)) {
          if (
            typeof a === 'object' &&
            a !== null &&
            Number.isInteger((a as IntakeAnswer).id) &&
            typeof (a as IntakeAnswer).answer === 'string' &&
            (a as IntakeAnswer).answer.length < 4000
          ) {
            safeAnswers.push({ id: (a as IntakeAnswer).id, answer: (a as IntakeAnswer).answer })
          }
        }

        const intake = runFinalise(draft as IntakeDraft, safeAnswers)

        const dir = join(app.getPath('userData'), 'projects', projectId)
        await mkdir(dir, { recursive: true })
        const outPath = join(dir, 'intake.json')
        await writeFile(outPath, JSON.stringify(intake, null, 2), 'utf8')

        auditLog('phases:intake:finalise', `projectId=${projectId} path=${outPath}`)
        return { intake, path: outPath }
      } catch (err) {
        auditLog('phases:intake:finalise:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 1: run planning (PRD + architecture) ──────────────────────
  ipcMain.handle(
    'phases:planning:run',
    async (event, input: unknown, projectId?: unknown): Promise<PlanningResult> => {
      try {
        validateSender(event)
        checkRateLimit('phases:planning:run')

        if (!isPlanningInput(input)) throw new Error('input is malformed')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }

        auditLog('phases:planning:run', `projectId=${projectId}`)
        const result = await runPlanning(input as PlanningInput, { projectId })

        // Persist artefacts under userData/<projectId>/
        const dir = join(app.getPath('userData'), 'projects', projectId)
        await mkdir(dir, { recursive: true })
        await Promise.all([
          writeFile(join(dir, 'prd.md'), result.prd, 'utf8'),
          writeFile(join(dir, 'architecture.json'), JSON.stringify(result.architecture, null, 2), 'utf8')
        ])

        auditLog('phases:planning:run:done', `projectId=${projectId}`)
        return result
      } catch (err) {
        auditLog('phases:planning:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 2: design brief + component map ───────────────────────────
  ipcMain.handle(
    'phases:design:run',
    async (event, projectId?: unknown): Promise<DesignResult> => {
      try {
        validateSender(event)
        checkRateLimit('phases:design:run')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }

        const dir = join(app.getPath('userData'), 'projects', projectId)
        const [prd, archRaw] = await Promise.all([
          import('fs/promises').then((fs) => fs.readFile(join(dir, 'prd.md'), 'utf8')),
          import('fs/promises').then((fs) => fs.readFile(join(dir, 'architecture.json'), 'utf8'))
        ])

        auditLog('phases:design:run', `projectId=${projectId}`)
        const result = await runDesign(prd, archRaw, { projectId })

        await writeFile(join(dir, 'design-brief.md'), result.brief, 'utf8')
        await writeFile(join(dir, 'ui-components.json'), JSON.stringify(result.components, null, 2), 'utf8')

        return result
      } catch (err) {
        auditLog('phases:design:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 3: scaffold — generate folder + stub files ───────────────
  ipcMain.handle(
    'phases:scaffold:run',
    async (event, projectName: unknown, projectId?: unknown): Promise<ScaffoldResult> => {
      try {
        validateSender(event)
        checkRateLimit('phases:scaffold:run')
        assertSafeString(projectName, 'projectName', 200)
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }

        const dir = join(app.getPath('userData'), 'projects', projectId)
        const archRaw = await import('fs/promises').then((fs) =>
          fs.readFile(join(dir, 'architecture.json'), 'utf8')
        )
        const architecture = JSON.parse(archRaw)

        auditLog('phases:scaffold:run', `projectId=${projectId}`)
        return await runScaffold(projectName as string, architecture, { projectId })
      } catch (err) {
        auditLog('phases:scaffold:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 4: codegen — implement files from scaffold ────────────────
  ipcMain.handle(
    'phases:codegen:run',
    async (event, projectId: unknown, scaffoldSlug: unknown): Promise<CodegenResult> => {
      try {
        validateSender(event)
        checkRateLimit('phases:codegen:run')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }
        assertSafeString(scaffoldSlug, 'scaffoldSlug', 100)

        auditLog('phases:codegen:run', `projectId=${projectId} slug=${scaffoldSlug}`)

        // Auto-approve each batch (renderer-driven codegen uses events instead)
        const autoApprove = async (): Promise<boolean> => true

        return await runCodegen(
          projectId,
          scaffoldSlug as string,
          autoApprove,
          (msg) => console.log('[codegen]', msg),
          { projectId }
        )
      } catch (err) {
        auditLog('phases:codegen:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 5: code review ─────────────────────────────────────────────
  ipcMain.handle(
    'phases:review:run',
    async (event, projectId: unknown, scaffoldSlug: unknown): Promise<ReviewReport> => {
      try {
        validateSender(event)
        checkRateLimit('phases:review:run')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }
        assertSafeString(scaffoldSlug, 'scaffoldSlug', 100)

        auditLog('phases:review:run', `projectId=${projectId} slug=${scaffoldSlug}`)
        return await runReview(
          projectId,
          scaffoldSlug as string,
          (msg) => console.log('[review]', msg),
          { projectId }
        )
      } catch (err) {
        auditLog('phases:review:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 6: security audit ──────────────────────────────────────────
  ipcMain.handle(
    'phases:security:run',
    async (event, projectId: unknown, scaffoldSlug: unknown): Promise<SecurityReport> => {
      try {
        validateSender(event)
        checkRateLimit('phases:security:run')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }
        assertSafeString(scaffoldSlug, 'scaffoldSlug', 100)

        auditLog('phases:security:run', `projectId=${projectId} slug=${scaffoldSlug}`)
        return await runSecurity(
          projectId,
          scaffoldSlug as string,
          (msg) => console.log('[security]', msg),
          { projectId }
        )
      } catch (err) {
        auditLog('phases:security:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Phase 7: Playwright testing ──────────────────────────────────────
  ipcMain.handle(
    'phases:testing:run',
    async (event, projectId: unknown, scaffoldSlug: unknown): Promise<TestingReport> => {
      try {
        validateSender(event)
        checkRateLimit('phases:testing:run')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }
        assertSafeString(scaffoldSlug, 'scaffoldSlug', 100)

        auditLog('phases:testing:run', `projectId=${projectId} slug=${scaffoldSlug}`)
        return await runTesting(
          projectId,
          scaffoldSlug as string,
          (msg) => console.log('[testing]', msg),
          { projectId }
        )
      } catch (err) {
        auditLog('phases:testing:run:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )
}

// ── Structural guards ────────────────────────────────────────────────

/**
 * Narrow a cross-IPC value to IntakeDraft shape — the sandboxed renderer
 * is untrusted even though we own it; structural check defends against
 * a compromised preload.
 */
function isDraft(v: unknown): v is IntakeDraft {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Partial<IntakeDraft>
  return (
    typeof d.rawIdea === 'string' &&
    typeof d.expanded === 'string' &&
    Array.isArray(d.questions) &&
    d.questions.every(
      (q) =>
        typeof q === 'object' &&
        q !== null &&
        Number.isInteger((q as { id?: unknown }).id) &&
        typeof (q as { question?: unknown }).question === 'string'
    )
  )
}

function isPlanningInput(v: unknown): v is PlanningInput {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Partial<PlanningInput>
  return (
    typeof p.expanded === 'string' &&
    p.expanded.trim().length > 0 &&
    Array.isArray(p.clarifications) &&
    p.clarifications.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as { question?: unknown }).question === 'string' &&
        typeof (c as { answer?: unknown }).answer === 'string'
    )
  )
}

// Unused but prevents an "unused crypto import" lint once we later stamp
// finalised intakes with an id.
void randomUUID
