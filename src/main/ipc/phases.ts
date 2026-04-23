// IPC for the phase pipeline. Day 8 exposes phase 0 (intake) — later
// days bolt on 1..8 using the same shape so the renderer can uniformly
// show "run → approve → finalise" for every phase.

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
          if (!UUID_RE.test(projectId)) {
            throw new Error('projectId must be a UUID')
          }
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
  // The draft + answers are re-sent from the renderer (stateless main);
  // we only persist the finalised JSON to disk.
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
            safeAnswers.push({
              id: (a as IntakeAnswer).id,
              answer: (a as IntakeAnswer).answer
            })
          }
        }

        const intake = runFinalise(draft as IntakeDraft, safeAnswers)

        // intake.json is written under userData/<projectId>/intake.json so
        // it's isolated per project and caller can't point us elsewhere.
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
}

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

// Unused but prevents an "unused crypto import" lint once we later stamp
// finalised intakes with an id.
void randomUUID
