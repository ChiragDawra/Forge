import { readFile, writeFile, access } from 'fs/promises'
import { join } from 'path'
import { routeTask } from '../ai/router'
import type { CallOptions } from '../ai/types'
import { getQueue, type AgentTask } from './task-queue'

// ─── Types ──────────────────────────────────────────────────────

export interface SessionEntry {
  phaseSlug: string
  tasks: TaskSummary[]
  startedAt: number
  completedAt: number
}

interface TaskSummary {
  title: string
  status: string
  taskType: string
  durationMs: number | null
}

// ─── Session tracker ────────────────────────────────────────────

const _sessions: SessionEntry[] = []

/**
 * Record a completed phase execution as a session entry.
 * Call this after executeQueue() finishes.
 */
export function recordSession(phaseSlug: string, tasks: AgentTask[]): SessionEntry {
  const entry: SessionEntry = {
    phaseSlug,
    tasks: tasks.map((t) => ({
      title: t.title,
      status: t.status,
      taskType: t.taskType,
      durationMs: t.startedAt && t.completedAt ? t.completedAt - t.startedAt : null
    })),
    startedAt: Math.min(...tasks.map((t) => t.startedAt ?? t.createdAt)),
    completedAt: Math.max(...tasks.map((t) => t.completedAt ?? Date.now()))
  }

  _sessions.push(entry)
  return entry
}

/**
 * Get all recorded sessions for the current app lifetime.
 */
export function getSessions(): SessionEntry[] {
  return [..._sessions]
}

// ─── Log generator ──────────────────────────────────────────────

const LOG_SYSTEM = `You are a session log writer for an AI app-builder called Forge.

Given a session with phase name, task summaries, and timing data, generate a concise Markdown session log entry.

Follow this structure:
## Day N — YYYY-MM-DD

**Goal:** [what was accomplished]

**Tasks completed:**
- [x] Task — description
- [ ] Task — failed/skipped (reason)

**Issues encountered:**
- [any failures or notable issues, or "None"]

**Summary:**
[1-2 sentence summary]

Return ONLY the markdown, no wrapping code fences.`

/**
 * Generate a formatted session log entry from recorded session data.
 * Uses Gemini (intake) for fast, cheap summarisation.
 */
export async function generateLogEntry(
  session: SessionEntry,
  dayNumber: number,
  opts: CallOptions = {}
): Promise<string> {
  const taskList = session.tasks
    .map(
      (t) =>
        `- ${t.title} [${t.status}] (${t.taskType}, ${t.durationMs ? `${Math.round(t.durationMs / 1000)}s` : 'n/a'})`
    )
    .join('\n')

  const prompt = `${LOG_SYSTEM}

Day number: ${dayNumber}
Date: ${new Date().toISOString().split('T')[0]}
Phase: ${session.phaseSlug}
Duration: ${Math.round((session.completedAt - session.startedAt) / 1000)}s

Tasks:
${taskList}`

  const response = await routeTask('intake', prompt, opts)
  return response.content.trim()
}

// ─── File writer ────────────────────────────────────────────────

/**
 * Append a session log entry to SESSION_LOG.md in the project root.
 * Creates the file if it doesn't exist.
 */
export async function appendToSessionLog(
  projectRoot: string,
  entry: string
): Promise<string> {
  const logPath = join(projectRoot, 'SESSION_LOG.md')

  let existing = ''
  try {
    await access(logPath)
    existing = await readFile(logPath, 'utf-8')
  } catch {
    // File doesn't exist — create with header
    existing = '# Forge — Session Log\n\n---\n'
  }

  const updated = existing.trimEnd() + '\n\n' + entry.trim() + '\n'
  await writeFile(logPath, updated, 'utf-8')
  return logPath
}

/**
 * Full pipeline: record session → generate log → write to file.
 * Convenience for callers who want a one-liner after phase execution.
 */
export async function logSession(
  projectRoot: string,
  phaseSlug: string,
  tasks: AgentTask[],
  dayNumber: number,
  opts: CallOptions = {}
): Promise<{ entry: SessionEntry; logPath: string; markdown: string }> {
  const entry = recordSession(phaseSlug, tasks)
  const markdown = await generateLogEntry(entry, dayNumber, opts)
  const logPath = await appendToSessionLog(projectRoot, markdown)
  return { entry, logPath, markdown }
}
