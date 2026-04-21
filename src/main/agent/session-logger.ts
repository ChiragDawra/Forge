// Writes a human-readable SESSION_LOG.md summary for a project session.
// Pulls model_usage + sessions rows from the DB and renders them as Markdown.

import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { eq, and, gte, lte, desc, sum, count } from 'drizzle-orm'
import { getDb } from '../db/client'
import { modelUsage, sessions, projects } from '../db/schema'

export interface SessionLogInput {
  sessionId: string
  /** Absolute path to write the markdown file. */
  outPath: string
  /** Optional free-form narrative written by the caller. */
  narrative?: string
}

export interface SessionLogResult {
  outPath: string
  sessionId: string
  projectId: string | null
  durationMs: number | null
  totalCostUsd: number
  totalCalls: number
  bytesWritten: number
}

/**
 * Render + persist a SESSION_LOG.md for the given session row.
 * Fails fast if the session doesn't exist.
 */
export async function writeSessionLog(input: SessionLogInput): Promise<SessionLogResult> {
  if (!input.sessionId) throw new Error('writeSessionLog: sessionId required')
  if (!input.outPath) throw new Error('writeSessionLog: outPath required')

  const db = getDb()
  const [session] = await db.select().from(sessions).where(eq(sessions.id, input.sessionId)).limit(1)
  if (!session) throw new Error(`writeSessionLog: session ${input.sessionId} not found`)

  const project = session.projectId
    ? (await db.select().from(projects).where(eq(projects.id, session.projectId)).limit(1))[0] ??
      null
    : null

  // Time window for usage aggregation = session start → end (or now).
  const startDate = session.startedAt instanceof Date ? session.startedAt : new Date(0)
  const endDate = session.endedAt instanceof Date ? session.endedAt : new Date()

  const usageRows = session.projectId
    ? await db
        .select({
          modelName: modelUsage.modelName,
          callCount: count(modelUsage.id),
          totalCostUsd: sum(modelUsage.costUsd),
          totalInputTokens: sum(modelUsage.inputTokens),
          totalOutputTokens: sum(modelUsage.outputTokens)
        })
        .from(modelUsage)
        .where(
          and(
            eq(modelUsage.projectId, session.projectId),
            gte(modelUsage.calledAt, startDate),
            lte(modelUsage.calledAt, endDate)
          )
        )
        .groupBy(modelUsage.modelName)
        .orderBy(desc(sum(modelUsage.costUsd)))
    : []

  const totalCostUsd = usageRows.reduce((a, r) => a + Number(r.totalCostUsd ?? 0), 0)
  const totalCalls = usageRows.reduce((a, r) => a + Number(r.callCount ?? 0), 0)
  const durationMs = session.endedAt
    ? endDate.getTime() - startDate.getTime()
    : null

  const md = renderMarkdown({
    session,
    project,
    usageRows,
    totalCostUsd,
    totalCalls,
    durationMs,
    narrative: input.narrative
  })

  await mkdir(dirname(input.outPath), { recursive: true })
  await writeFile(input.outPath, md, 'utf8')

  return {
    outPath: input.outPath,
    sessionId: input.sessionId,
    projectId: session.projectId ?? null,
    durationMs,
    totalCostUsd,
    totalCalls,
    bytesWritten: Buffer.byteLength(md, 'utf8')
  }
}

interface RenderInput {
  session: { id: string; startedAt: Date; endedAt: Date | null; summary: string | null }
  project: { id: string; name: string; prompt: string } | null
  usageRows: Array<{
    modelName: string
    callCount: number
    totalCostUsd: string | number | null
    totalInputTokens: string | number | null
    totalOutputTokens: string | number | null
  }>
  totalCostUsd: number
  totalCalls: number
  durationMs: number | null
  narrative?: string
}

function renderMarkdown(x: RenderInput): string {
  const { session, project, usageRows, totalCostUsd, totalCalls, durationMs, narrative } = x
  const lines: string[] = []

  lines.push(`# Session Log — ${project?.name ?? 'Unassigned'}`)
  lines.push('')
  lines.push(`**Session ID:** \`${session.id}\``)
  if (project) lines.push(`**Project:** ${project.name} (\`${project.id}\`)`)
  lines.push(`**Started:** ${session.startedAt.toISOString()}`)
  lines.push(`**Ended:** ${session.endedAt ? session.endedAt.toISOString() : 'in progress'}`)
  if (durationMs != null) lines.push(`**Duration:** ${formatDuration(durationMs)}`)
  lines.push('')

  if (narrative?.trim()) {
    lines.push('## Summary', '', narrative.trim(), '')
  } else if (session.summary?.trim()) {
    lines.push('## Summary', '', session.summary.trim(), '')
  }

  lines.push('## Model usage', '')
  if (usageRows.length === 0) {
    lines.push('_No AI calls recorded for this session._', '')
  } else {
    lines.push('| Model | Calls | Input tokens | Output tokens | Cost |')
    lines.push('|-------|------:|-------------:|--------------:|-----:|')
    for (const r of usageRows) {
      lines.push(
        `| ${r.modelName} | ${r.callCount} | ${Number(r.totalInputTokens ?? 0)} | ${Number(r.totalOutputTokens ?? 0)} | ${formatCost(Number(r.totalCostUsd ?? 0))} |`
      )
    }
    lines.push('')
    lines.push(`**Totals:** ${totalCalls} calls · ${formatCost(totalCostUsd)}`)
    lines.push('')
  }

  return lines.join('\n')
}

function formatCost(usd: number): string {
  if (!Number.isFinite(usd) || usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
}
