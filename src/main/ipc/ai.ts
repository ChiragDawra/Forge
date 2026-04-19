import { ipcMain } from 'electron'
import { desc, sum, eq, count, gte, max, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { modelUsage } from '../db/schema'
import { routeTask, type TaskType } from '../ai/router'
import { reinitAiClients } from '../ai/init'
import { validateSender, checkRateLimit, assertSafeString, auditLog, safeErrorMessage } from './security'
import type { ModelResponse } from '../ai/types'

export interface UsageSummaryRow {
  modelName: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  callCount: number
  lastUsedAt: number | null
}

export interface DailyUsageRow {
  date: string // YYYY-MM-DD
  modelName: string
  totalCostUsd: number
  totalTokens: number
  callCount: number
}

export interface UsageRow {
  id: string
  modelName: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  calledAt: number
  projectId: string | null
  phaseId: string | null
}

// Drizzle's timestamp mode stores unix seconds; direct selects give Date,
// but aggregations (max, min) and raw SQL give the raw integer. Normalise.
function toMillis(v: unknown): number | null {
  if (v == null) return null
  if (v instanceof Date) return v.getTime()
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  // Seconds since epoch are all < 1e12 well past year 33000
  return n < 1e12 ? n * 1000 : n
}

export function registerAiIpc(): void {
  // ── Call a model via the router ────────────────────────────────────────
  ipcMain.handle(
    'ai:call',
    async (
      event,
      taskType: TaskType,
      prompt: string,
      projectId?: string,
      phaseId?: string
    ): Promise<ModelResponse> => {
      try {
        validateSender(event)
        checkRateLimit('ai:call')
        assertSafeString(taskType, 'taskType', 32)
        assertSafeString(prompt, 'prompt', 100_000)

        auditLog('ai:call', `task=${taskType} project=${projectId ?? 'none'}`)
        return await routeTask(taskType, prompt, { projectId, phaseId })
      } catch (err) {
        auditLog('ai:call:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Re-init clients after key update ──────────────────────────────────
  ipcMain.handle('ai:reinit', async (event): Promise<void> => {
    try {
      validateSender(event)
      checkRateLimit('ai:reinit')
      await reinitAiClients()
      auditLog('ai:reinit', 'AI clients reinitialised')
    } catch (err) {
      auditLog('ai:reinit:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  // ── Get per-model usage summary (for Models page) ─────────────────────
  ipcMain.handle('ai:usage-summary', async (event): Promise<UsageSummaryRow[]> => {
    try {
      validateSender(event)
      checkRateLimit('ai:usage-summary')

      const db = getDb()
      const rows = await db
        .select({
          modelName: modelUsage.modelName,
          totalInputTokens: sum(modelUsage.inputTokens),
          totalOutputTokens: sum(modelUsage.outputTokens),
          totalCostUsd: sum(modelUsage.costUsd),
          callCount: count(modelUsage.id),
          lastUsedAt: max(modelUsage.calledAt)
        })
        .from(modelUsage)
        .groupBy(modelUsage.modelName)

      return rows.map((r) => ({
        modelName: r.modelName,
        totalInputTokens: Number(r.totalInputTokens ?? 0),
        totalOutputTokens: Number(r.totalOutputTokens ?? 0),
        totalCostUsd: Number(r.totalCostUsd ?? 0),
        callCount: Number(r.callCount ?? 0),
        lastUsedAt: toMillis(r.lastUsedAt)
      }))
    } catch (err) {
      auditLog('ai:usage-summary:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  // ── Get total cost across all models (for Header) ─────────────────────
  ipcMain.handle('ai:total-cost', async (event): Promise<number> => {
    try {
      validateSender(event)
      checkRateLimit('ai:total-cost')

      const db = getDb()
      const [row] = await db
        .select({ total: sum(modelUsage.costUsd) })
        .from(modelUsage)

      return Number(row?.total ?? 0)
    } catch (err) {
      auditLog('ai:total-cost:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  // ── Get per-day per-model usage for the last N days (chart) ───────────
  ipcMain.handle('ai:usage-daily', async (event, days = 7): Promise<DailyUsageRow[]> => {
    try {
      validateSender(event)
      checkRateLimit('ai:usage-daily')

      const n = Math.min(Math.max(Number(days) || 7, 1), 90)
      const sinceMs = Date.now() - n * 24 * 60 * 60 * 1000
      const sinceDate = new Date(sinceMs)

      const db = getDb()
      // Bucket by YYYY-MM-DD in local time. called_at is stored as unix seconds.
      const dateExpr = sql<string>`strftime('%Y-%m-%d', ${modelUsage.calledAt}, 'unixepoch', 'localtime')`

      const rows = await db
        .select({
          date: dateExpr,
          modelName: modelUsage.modelName,
          totalCostUsd: sum(modelUsage.costUsd),
          totalInputTokens: sum(modelUsage.inputTokens),
          totalOutputTokens: sum(modelUsage.outputTokens),
          callCount: count(modelUsage.id)
        })
        .from(modelUsage)
        .where(gte(modelUsage.calledAt, sinceDate))
        .groupBy(dateExpr, modelUsage.modelName)

      return rows.map((r) => ({
        date: r.date,
        modelName: r.modelName,
        totalCostUsd: Number(r.totalCostUsd ?? 0),
        totalTokens: Number(r.totalInputTokens ?? 0) + Number(r.totalOutputTokens ?? 0),
        callCount: Number(r.callCount ?? 0)
      }))
    } catch (err) {
      auditLog('ai:usage-daily:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  // ── Get recent usage rows for a project ───────────────────────────────
  ipcMain.handle('ai:usage-by-project', async (event, projectId: string): Promise<UsageRow[]> => {
    try {
      validateSender(event)
      checkRateLimit('ai:usage-by-project')
      assertSafeString(projectId, 'projectId', 64)

      const db = getDb()
      const rows = await db
        .select()
        .from(modelUsage)
        .where(eq(modelUsage.projectId, projectId))
        .orderBy(desc(modelUsage.calledAt))
        .limit(100)

      return rows.map((r) => ({
        id: r.id,
        modelName: r.modelName,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.costUsd,
        calledAt: toMillis(r.calledAt) ?? 0,
        projectId: r.projectId,
        phaseId: r.phaseId
      }))
    } catch (err) {
      auditLog('ai:usage-by-project:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })
}
