import { ipcMain } from 'electron'
import { validateSender, checkRateLimit, assertSafeString, safeErrorMessage, auditLog } from './security'
import { decompose, executeQueue, getQueue, getQueueSummary, clearQueue, onTaskEvent } from '../agent/task-queue'
import { logSession, getSessions } from '../agent/session-logger'

export function registerAgentIpc(): void {
  // ─── Task Queue: decompose ──────────────────────────────────

  ipcMain.handle(
    'agent:decompose',
    async (event, phaseSlug: unknown, phaseGoal: unknown, projectId?: unknown) => {
      validateSender(event)
      checkRateLimit('agent:decompose')
      assertSafeString(phaseSlug, 'phaseSlug', 128)
      assertSafeString(phaseGoal, 'phaseGoal', 10_000)
      auditLog('agent:decompose', phaseSlug as string)

      try {
        const opts = typeof projectId === 'string' ? { projectId } : {}
        return await decompose(phaseSlug as string, phaseGoal as string, opts)
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ─── Task Queue: execute ────────────────────────────────────

  ipcMain.handle(
    'agent:execute-queue',
    async (event, phaseSlug: unknown, projectId?: unknown) => {
      validateSender(event)
      checkRateLimit('agent:execute-queue')
      assertSafeString(phaseSlug, 'phaseSlug', 128)
      auditLog('agent:execute-queue', phaseSlug as string)

      try {
        const opts = typeof projectId === 'string' ? { projectId } : {}
        return await executeQueue(phaseSlug as string, opts)
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ─── Task Queue: queries ────────────────────────────────────

  ipcMain.handle('agent:queue', async (event, phaseSlug: unknown) => {
    validateSender(event)
    checkRateLimit('agent:queue')
    assertSafeString(phaseSlug, 'phaseSlug', 128)
    return getQueue(phaseSlug as string)
  })

  ipcMain.handle('agent:queue-summary', async (event, phaseSlug: unknown) => {
    validateSender(event)
    checkRateLimit('agent:queue-summary')
    assertSafeString(phaseSlug, 'phaseSlug', 128)
    return getQueueSummary(phaseSlug as string)
  })

  ipcMain.handle('agent:clear-queue', async (event, phaseSlug: unknown) => {
    validateSender(event)
    checkRateLimit('agent:clear-queue')
    assertSafeString(phaseSlug, 'phaseSlug', 128)
    auditLog('agent:clear-queue', phaseSlug as string)
    clearQueue(phaseSlug as string)
  })

  // ─── Session Logger ─────────────────────────────────────────

  ipcMain.handle(
    'agent:log-session',
    async (
      event,
      projectRoot: unknown,
      phaseSlug: unknown,
      dayNumber: unknown,
      projectId?: unknown
    ) => {
      validateSender(event)
      checkRateLimit('agent:log-session')
      assertSafeString(projectRoot, 'projectRoot', 1024)
      assertSafeString(phaseSlug, 'phaseSlug', 128)
      auditLog('agent:log-session', phaseSlug as string)

      if (typeof dayNumber !== 'number' || dayNumber < 1) {
        throw new Error('dayNumber must be a positive number')
      }

      try {
        const tasks = getQueue(phaseSlug as string)
        if (tasks.length === 0) {
          throw new Error(`No tasks found for phase: ${phaseSlug}`)
        }
        const opts = typeof projectId === 'string' ? { projectId } : {}
        return await logSession(
          projectRoot as string,
          phaseSlug as string,
          tasks,
          dayNumber,
          opts
        )
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  ipcMain.handle('agent:sessions', async (event) => {
    validateSender(event)
    checkRateLimit('agent:sessions')
    return getSessions()
  })
}
