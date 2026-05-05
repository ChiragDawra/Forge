// IPC bridge for the orchestrator.
// The renderer starts/approves/cancels the pipeline via invoke();
// the main process pushes real-time events back via webContents.send().

import { ipcMain, BrowserWindow } from 'electron'
import {
  getOrCreateOrchestrator,
  destroyOrchestrator,
  type OrchestratorEvent
} from '../agent/orchestrator'
import { runIntake } from '../agent/phases/0-intake'
import { runPlanning } from '../agent/phases/1-planning'
import { runDesign } from '../agent/phases/2-design'
import { runScaffold } from '../agent/phases/3-scaffold'
import { runCodegen } from '../agent/phases/4-codegen'
import { runReview } from '../agent/phases/5-review'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import {
  validateSender,
  checkRateLimit,
  safeErrorMessage,
  auditLog
} from './security'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function registerOrchestratorIpc(): void {
  // ── Start pipeline ──────────────────────────────────────────────────
  ipcMain.handle(
    'orchestrator:start',
    async (event, projectId: unknown, startPhase?: unknown) => {
      try {
        validateSender(event)
        checkRateLimit('orchestrator:start')
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
          throw new Error('projectId must be a UUID')
        }
        const fromPhase = typeof startPhase === 'number' && startPhase >= 0 ? Math.floor(startPhase) : 0
        auditLog('orchestrator:start', `projectId=${projectId} from=${fromPhase}`)

        // Destroy any existing orchestrator for this project first.
        destroyOrchestrator(projectId)
        const orch = getOrCreateOrchestrator(projectId)
        const win = BrowserWindow.fromWebContents(event.sender)

        // Forward all orchestrator events to the renderer.
        orch.on('event', (evt: OrchestratorEvent) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('orchestrator:event', evt)
          }
        })

        // Run pipeline in the background — don't await here so IPC returns
        // immediately. The renderer learns about completion via events.
        orch
          .run(fromPhase, makePhaseRunner(projectId))
          .catch((err) => {
            console.error('[orchestrator] unhandled error:', err)
          })

        return { ok: true, phases: orch.phaseSnapshot }
      } catch (err) {
        auditLog('orchestrator:start:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Approve current waiting phase ───────────────────────────────────
  ipcMain.handle('orchestrator:approve', async (event, projectId: unknown) => {
    try {
      validateSender(event)
      checkRateLimit('orchestrator:approve')
      if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
        throw new Error('projectId must be a UUID')
      }
      auditLog('orchestrator:approve', `projectId=${projectId}`)
      const orch = getOrCreateOrchestrator(projectId)
      orch.approve()
      return { ok: true }
    } catch (err) {
      throw new Error(safeErrorMessage(err))
    }
  })

  // ── Cancel pipeline ─────────────────────────────────────────────────
  ipcMain.handle('orchestrator:cancel', async (event, projectId: unknown) => {
    try {
      validateSender(event)
      checkRateLimit('orchestrator:cancel')
      if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
        throw new Error('projectId must be a UUID')
      }
      auditLog('orchestrator:cancel', `projectId=${projectId}`)
      destroyOrchestrator(projectId)
      return { ok: true }
    } catch (err) {
      throw new Error(safeErrorMessage(err))
    }
  })

  // ── Get current phase snapshot ──────────────────────────────────────
  ipcMain.handle('orchestrator:phases', async (event, projectId: unknown) => {
    try {
      validateSender(event)
      if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
        throw new Error('projectId must be a UUID')
      }
      const orch = getOrCreateOrchestrator(projectId)
      return orch.phaseSnapshot
    } catch (err) {
      throw new Error(safeErrorMessage(err))
    }
  })
}

/**
 * Build the per-phase runner that the orchestrator calls.
 * Phases not yet implemented are stubs that resolve immediately.
 */
function makePhaseRunner(
  projectId: string
): (index: number, _projectId: string, log: (msg: string) => void) => Promise<void> {
  return async (index, _projectId, log) => {
    const dir = join(app.getPath('userData'), 'projects', projectId)

    switch (index) {
      case 0: {
        // Intake — read from already-persisted intake.json or run fresh
        log('Checking for existing intake.json…')
        try {
          await readFile(join(dir, 'intake.json'), 'utf8')
          log('intake.json found — skipping model call')
        } catch {
          log('No intake.json found — run the intake phase manually first')
          throw new Error('intake.json not found — complete the Intake phase first')
        }
        break
      }
      case 1: {
        // Planning — read from already-persisted prd.md or run fresh
        log('Checking for existing prd.md…')
        try {
          await readFile(join(dir, 'prd.md'), 'utf8')
          log('prd.md found — skipping model call')
        } catch {
          log('No prd.md — running planning phase…')
          const intakeRaw = await readFile(join(dir, 'intake.json'), 'utf8')
          const intake = JSON.parse(intakeRaw)
          await runPlanning(
            { expanded: intake.expanded, clarifications: intake.clarifications },
            { projectId }
          )
          log('planning complete')
        }
        break
      }
      case 2: {
        log('Checking for existing design-brief.md…')
        try {
          await readFile(join(dir, 'design-brief.md'), 'utf8')
          log('design-brief.md found — skipping model call')
        } catch {
          log('Running design phase…')
          const [prd, archRaw] = await Promise.all([
            readFile(join(dir, 'prd.md'), 'utf8'),
            readFile(join(dir, 'architecture.json'), 'utf8')
          ])
          const result = await runDesign(prd, archRaw, { projectId })
          const { writeFile, mkdir } = await import('fs/promises')
          await mkdir(dir, { recursive: true })
          await writeFile(join(dir, 'design-brief.md'), result.brief, 'utf8')
          await writeFile(join(dir, 'ui-components.json'), JSON.stringify(result.components, null, 2), 'utf8')
          log('design phase complete')
        }
        break
      }
      case 3: {
        log('Checking for scaffold…')
        try {
          await readFile(join(dir, 'ui-components.json'), 'utf8')
          log('Scaffold found — skipping')
        } catch {
          log('Running scaffold phase…')
          const archRaw = await readFile(join(dir, 'architecture.json'), 'utf8')
          const architecture = JSON.parse(archRaw)
          await runScaffold(projectId.slice(0, 30), architecture, { projectId })
          log('scaffold complete')
        }
        break
      }
      case 4: {
        log('Running codegen phase…')
        const slug = projectId.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        await runCodegen(
          projectId,
          slug,
          async (batchIndex, filesWritten, filesPlanned) => {
            log(`Batch ${batchIndex + 1} done (${filesWritten}/${filesPlanned} files). Waiting for approval…`)
            // Delegate to the orchestrator's public approval gate
            const orch = getOrCreateOrchestrator(projectId)
            await orch.pauseForApproval()
            return true
          },
          log,
          { projectId }
        )
        log('codegen phase complete')
        break
      }
      case 5: {
        log('Running code review phase…')
        const reviewSlug = projectId.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        await runReview(projectId, reviewSlug, log, { projectId })
        log('code review phase complete')
        break
      }
      default:
        // Phases 6-8: stubs — will be wired in Days 16-18
        log(`Phase ${index} not yet implemented — skipping`)
        await new Promise<void>((r) => setTimeout(r, 200))
    }
  }
}

// Separate from the factory to avoid circular imports in future phases.
export { runIntake, runPlanning }
