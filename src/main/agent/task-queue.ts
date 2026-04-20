import { randomUUID } from 'crypto'
import { routeTask, type TaskType } from '../ai/router'
import type { CallOptions, ModelResponse } from '../ai/types'

// ─── Types ──────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface AgentTask {
  id: string
  phaseSlug: string
  title: string
  prompt: string
  taskType: TaskType
  status: TaskStatus
  dependsOn: string[] // task IDs that must complete first
  result: ModelResponse | null
  error: string | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
}

export interface DecomposeResult {
  phaseSlug: string
  tasks: AgentTask[]
}

export type TaskEventType = 'queued' | 'started' | 'completed' | 'failed' | 'skipped'

export interface TaskEvent {
  type: TaskEventType
  taskId: string
  title: string
  timestamp: number
}

export type TaskListener = (event: TaskEvent) => void

// ─── Task Queue ─────────────────────────────────────────────────

const _queues = new Map<string, AgentTask[]>()
const _listeners: TaskListener[] = []

function emit(type: TaskEventType, task: AgentTask): void {
  const event: TaskEvent = {
    type,
    taskId: task.id,
    title: task.title,
    timestamp: Date.now()
  }
  for (const fn of _listeners) {
    try { fn(event) } catch { /* listener errors don't break the queue */ }
  }
}

export function onTaskEvent(listener: TaskListener): () => void {
  _listeners.push(listener)
  return () => {
    const idx = _listeners.indexOf(listener)
    if (idx >= 0) _listeners.splice(idx, 1)
  }
}

// ─── Decomposer ─────────────────────────────────────────────────

const DECOMPOSE_SYSTEM = `You are a task decomposer for an AI app-builder called Forge.

Given a phase goal, break it into a sequence of atomic tasks.
Each task has:
- title: short imperative description (e.g. "Create database schema")
- prompt: the full prompt to send to an AI model for execution
- taskType: one of intake, planning, codegen, review, security, testing, deploy, generic
- dependsOn: array of task titles this task depends on (empty if none)

Return ONLY valid JSON — an array of task objects. No markdown, no explanation.

Example:
[
  {"title":"Scaffold routes","prompt":"Create Express routes for...","taskType":"codegen","dependsOn":[]},
  {"title":"Write tests","prompt":"Generate Jest tests for...","taskType":"testing","dependsOn":["Scaffold routes"]}
]`

/**
 * Decompose a phase goal into atomic tasks using Gemini (fast + cheap).
 * Returns tasks in execution order with dependency tracking.
 */
export async function decompose(
  phaseSlug: string,
  phaseGoal: string,
  opts: CallOptions = {}
): Promise<DecomposeResult> {
  const response = await routeTask('intake', `${DECOMPOSE_SYSTEM}\n\nPhase: ${phaseSlug}\nGoal: ${phaseGoal}`, opts)

  let parsed: Array<{ title: string; prompt: string; taskType: TaskType; dependsOn: string[] }>
  try {
    const cleaned = response.content.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Failed to parse decompose output: ${response.content.slice(0, 200)}`)
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Decomposer returned empty or invalid task list')
  }

  // Build tasks with IDs and resolve title-based deps to ID-based deps
  const titleToId = new Map<string, string>()
  const tasks: AgentTask[] = parsed.map((raw) => {
    const id = randomUUID()
    titleToId.set(raw.title, id)
    return {
      id,
      phaseSlug,
      title: raw.title,
      prompt: raw.prompt,
      taskType: raw.taskType || 'generic',
      status: 'pending' as TaskStatus,
      dependsOn: [], // resolved below
      result: null,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null
    }
  })

  // Resolve dependency titles → IDs
  for (let i = 0; i < tasks.length; i++) {
    const raw = parsed[i]
    tasks[i].dependsOn = (raw.dependsOn ?? [])
      .map((title) => titleToId.get(title))
      .filter((id): id is string => id !== undefined)
  }

  _queues.set(phaseSlug, tasks)
  tasks.forEach((t) => emit('queued', t))

  return { phaseSlug, tasks }
}

// ─── Executor ───────────────────────────────────────────────────

function canRun(task: AgentTask, allTasks: AgentTask[]): boolean {
  if (task.status !== 'pending') return false
  return task.dependsOn.every((depId) => {
    const dep = allTasks.find((t) => t.id === depId)
    return dep?.status === 'done'
  })
}

/**
 * Execute all tasks in a phase queue, respecting dependency order.
 * Tasks with satisfied deps run sequentially (one at a time for safety).
 */
export async function executeQueue(
  phaseSlug: string,
  opts: CallOptions = {}
): Promise<AgentTask[]> {
  const tasks = _queues.get(phaseSlug)
  if (!tasks || tasks.length === 0) {
    throw new Error(`No task queue found for phase: ${phaseSlug}`)
  }

  let progress = true
  while (progress) {
    progress = false
    for (const task of tasks) {
      if (!canRun(task, tasks)) continue

      task.status = 'running'
      task.startedAt = Date.now()
      emit('started', task)

      try {
        task.result = await routeTask(task.taskType, task.prompt, opts)
        task.status = 'done'
        task.completedAt = Date.now()
        emit('completed', task)
        progress = true
      } catch (err) {
        task.status = 'failed'
        task.error = err instanceof Error ? err.message : String(err)
        task.completedAt = Date.now()
        emit('failed', task)

        // Skip downstream tasks
        skipDependents(task.id, tasks)
        progress = true
      }
    }
  }

  return tasks
}

function skipDependents(failedId: string, tasks: AgentTask[]): void {
  for (const task of tasks) {
    if (task.status === 'pending' && task.dependsOn.includes(failedId)) {
      task.status = 'skipped'
      task.error = `Skipped — dependency "${failedId}" failed`
      emit('skipped', task)
      skipDependents(task.id, tasks)
    }
  }
}

// ─── Queries ────────────────────────────────────────────────────

export function getQueue(phaseSlug: string): AgentTask[] {
  return _queues.get(phaseSlug) ?? []
}

export function getQueueSummary(phaseSlug: string): {
  total: number
  pending: number
  running: number
  done: number
  failed: number
  skipped: number
} {
  const tasks = getQueue(phaseSlug)
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    running: tasks.filter((t) => t.status === 'running').length,
    done: tasks.filter((t) => t.status === 'done').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    skipped: tasks.filter((t) => t.status === 'skipped').length
  }
}

export function clearQueue(phaseSlug: string): void {
  _queues.delete(phaseSlug)
}
