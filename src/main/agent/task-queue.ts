// GSD decomposer: turns a phase goal into an ordered list of atomic tasks.
// The LLM returns strict JSON; we validate + clamp before handing back so a
// rogue model response can't crash downstream consumers.

import { routeTask } from '../ai/router'
import type { CallOptions } from '../ai/types'

export interface AtomicTask {
  id: number // 1-based order
  title: string // short imperative, e.g. "Create auth schema"
  rationale: string // one-line why
  estimate: 'S' | 'M' | 'L' // rough size
  dependsOn: number[] // ids this task requires
}

export interface DecomposeOptions extends CallOptions {
  /** Hard cap on how many tasks we'll keep from the model output. */
  maxTasks?: number
}

const DEFAULT_MAX_TASKS = 20

const SYSTEM_PROMPT = `You are a software planning assistant called GSD (Get Shit Done).
Your job: decompose a high-level phase goal into a short, ordered list of
atomic, independently-shippable tasks.

Rules:
- Each task does exactly ONE thing. If a task has "and" in the title, split it.
- Prefer 4–12 tasks. Never more than 20.
- Tasks must be orderable; use dependsOn to encode hard ordering only.
- Use imperative titles ("Create users table", not "Creating users table").
- estimate: S = <1h, M = 1–3h, L = half-day+

Output STRICTLY valid JSON matching this schema, with no prose, no markdown:
{
  "tasks": [
    { "id": 1, "title": string, "rationale": string, "estimate": "S"|"M"|"L", "dependsOn": number[] }
  ]
}`

export interface DecomposeResult {
  goal: string
  tasks: AtomicTask[]
  model: string
  costUsd: number
}

/**
 * Decompose a phase goal into atomic tasks via the planning-class model.
 */
export async function decomposeGoal(
  goal: string,
  opts: DecomposeOptions = {}
): Promise<DecomposeResult> {
  const trimmed = goal?.trim()
  if (!trimmed) throw new Error('decomposeGoal: goal is required')
  if (trimmed.length > 4000) {
    throw new Error('decomposeGoal: goal too long (>4000 chars)')
  }

  const userPrompt = `${SYSTEM_PROMPT}\n\n---\nPhase goal: ${trimmed}\n\nReturn only JSON.`
  const response = await routeTask('planning', userPrompt, opts)
  const tasks = parseAndValidate(response.content, opts.maxTasks ?? DEFAULT_MAX_TASKS)

  return {
    goal: trimmed,
    tasks,
    model: response.model,
    costUsd: response.costUsd
  }
}

/**
 * Extract a JSON object from the model's text — tolerant of stray markdown
 * fences some models emit despite instructions.
 */
function parseAndValidate(raw: string, maxTasks: number): AtomicTask[] {
  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error('decomposeGoal: model did not return JSON')
  }
  const payload = raw.slice(jsonStart, jsonEnd + 1)

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch (err) {
    throw new Error(`decomposeGoal: invalid JSON — ${(err as Error).message}`)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) {
    throw new Error('decomposeGoal: response missing tasks[]')
  }

  const out: AtomicTask[] = []
  for (const t of parsed.tasks.slice(0, maxTasks)) {
    if (!isRecord(t)) continue
    const id = Number(t.id)
    const title = typeof t.title === 'string' ? t.title.trim() : ''
    const rationale = typeof t.rationale === 'string' ? t.rationale.trim() : ''
    const estimate = t.estimate === 'S' || t.estimate === 'M' || t.estimate === 'L'
      ? t.estimate
      : 'M'
    const dependsOn = Array.isArray(t.dependsOn)
      ? t.dependsOn.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : []

    if (!Number.isInteger(id) || id < 1 || !title) continue
    out.push({ id, title, rationale, estimate, dependsOn })
  }

  if (out.length === 0) throw new Error('decomposeGoal: no valid tasks in response')
  return out
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
