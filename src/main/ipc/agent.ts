import { ipcMain, app } from 'electron'
import { isAbsolute, join, relative, resolve } from 'path'
import { decomposeGoal, type DecomposeResult } from '../agent/task-queue'
import { writeSessionLog, type SessionLogResult } from '../agent/session-logger'
import {
  validateSender,
  checkRateLimit,
  assertSafeString,
  auditLog,
  safeErrorMessage
} from './security'

export function registerAgentIpc(): void {
  // ── Decompose a phase goal into atomic tasks ──────────────────────────
  ipcMain.handle(
    'agent:decompose',
    async (
      event,
      goal: string,
      projectId?: string,
      phaseId?: string
    ): Promise<DecomposeResult> => {
      try {
        validateSender(event)
        checkRateLimit('agent:decompose')
        assertSafeString(goal, 'goal', 4000)
        if (projectId != null) assertSafeString(projectId, 'projectId', 64)
        if (phaseId != null) assertSafeString(phaseId, 'phaseId', 64)

        auditLog('agent:decompose', `goal-len=${goal.length} project=${projectId ?? 'none'}`)
        return await decomposeGoal(goal, { projectId, phaseId })
      } catch (err) {
        auditLog('agent:decompose:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Write SESSION_LOG.md for a given session ──────────────────────────
  ipcMain.handle(
    'agent:write-session-log',
    async (
      event,
      sessionId: string,
      outPath: string,
      narrative?: string
    ): Promise<SessionLogResult> => {
      try {
        validateSender(event)
        checkRateLimit('agent:write-session-log')
        assertSafeString(sessionId, 'sessionId', 64)
        assertSafeString(outPath, 'outPath', 1024)
        if (narrative != null) assertSafeString(narrative, 'narrative', 20_000)

        const safeOut = assertSafeSessionLogPath(outPath)
        auditLog('agent:write-session-log', `session=${sessionId} out=${safeOut}`)
        return await writeSessionLog({ sessionId, outPath: safeOut, narrative })
      } catch (err) {
        auditLog('agent:write-session-log:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )
}

/**
 * Session logs may only be written inside <userData>/session-logs.
 * This blocks arbitrary file writes (e.g. ~/.ssh/authorized_keys,
 * LaunchAgents plists, shell rc files) from a compromised renderer or a
 * prompt-injected agent workflow.
 */
function assertSafeSessionLogPath(outPath: string): string {
  if (!isAbsolute(outPath)) {
    throw new Error('outPath must be an absolute path')
  }
  if (!outPath.endsWith('.md')) {
    throw new Error('outPath must have a .md extension')
  }

  const root = resolve(join(app.getPath('userData'), 'session-logs'))
  const resolved = resolve(outPath)
  const rel = relative(root, resolved)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('outPath must be inside the session-logs directory')
  }
  return resolved
}
