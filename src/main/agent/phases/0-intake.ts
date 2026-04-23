// Phase 0 — Intake.
// Takes the user's raw idea, expands it, and generates clarifying
// questions. The renderer shows these via ApprovalGate; once answered,
// runFinalise() merges answers into a canonical intake.json which is
// the contract consumed by phase 1 (Planning).
//
// Two-step design on purpose:
//   runIntake()   → model call, returns expanded brief + questions
//   runFinalise() → pure local merge, no model call, cheap to replay

import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { buildIntakeUserPrompt } from '../prompts/intake'
import type { CallOptions, ModelResponse } from '../../ai/types'

export interface IntakeQuestion {
  id: number
  question: string
  why: string
}

export interface IntakeDraft {
  rawIdea: string
  expanded: string
  questions: IntakeQuestion[]
  model: string
  costUsd: number
}

export interface IntakeAnswer {
  id: number
  answer: string
}

export interface IntakeJson {
  rawIdea: string
  expanded: string
  clarifications: {
    question: string
    answer: string
  }[]
  finalisedAt: number
}

const MAX_IDEA_LEN = 10_000

/**
 * Run the intake model call. The caller is expected to gate this on
 * user approval before persisting or chaining into phase 1.
 */
export async function runIntake(
  rawIdea: string,
  opts: CallOptions = {}
): Promise<IntakeDraft> {
  const trimmed = rawIdea?.trim()
  if (!trimmed) throw new Error('runIntake: rawIdea is required')
  if (trimmed.length > MAX_IDEA_LEN) {
    throw new Error(`runIntake: rawIdea too long (>${MAX_IDEA_LEN} chars)`)
  }

  const userPrompt = buildIntakeUserPrompt(trimmed)
  const response = await routeTask('intake', userPrompt, opts)
  // Intake is attributed to the project for cost tracking; router already
  // returns the bill, we only need to record it.
  await logUsage(response, opts)

  const { expanded, questions } = parseAndValidate(response.content)
  return {
    rawIdea: trimmed,
    expanded,
    questions,
    model: response.model,
    costUsd: response.costUsd
  }
}

/**
 * Merge user answers onto a draft to produce the canonical intake.json.
 * Missing answers become empty strings rather than rejecting the phase —
 * the renderer can still warn, but the pipeline shouldn't hard-fail.
 */
export function runFinalise(
  draft: IntakeDraft,
  answers: IntakeAnswer[]
): IntakeJson {
  const byId = new Map<number, string>()
  for (const a of answers) {
    if (Number.isInteger(a?.id) && typeof a.answer === 'string') {
      byId.set(a.id, a.answer.trim())
    }
  }

  return {
    rawIdea: draft.rawIdea,
    expanded: draft.expanded,
    clarifications: draft.questions.map((q) => ({
      question: q.question,
      answer: byId.get(q.id) ?? ''
    })),
    finalisedAt: Date.now()
  }
}

// Exposed for testing the JSON parser in isolation — not called by IPC.
export function __parseIntakeResponseForTest(raw: string): {
  expanded: string
  questions: IntakeQuestion[]
} {
  return parseAndValidate(raw)
}

function parseAndValidate(raw: string): { expanded: string; questions: IntakeQuestion[] } {
  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error('runIntake: model did not return JSON')
  }
  const payload = raw.slice(jsonStart, jsonEnd + 1)

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch (err) {
    throw new Error(`runIntake: invalid JSON — ${(err as Error).message}`)
  }

  if (!isRecord(parsed)) throw new Error('runIntake: response is not an object')
  const expanded = typeof parsed.expanded === 'string' ? parsed.expanded.trim() : ''
  const qs = Array.isArray(parsed.questions) ? parsed.questions : []

  if (!expanded) throw new Error('runIntake: response missing "expanded"')

  const questions: IntakeQuestion[] = []
  for (const q of qs.slice(0, 5)) {
    if (!isRecord(q)) continue
    const id = Number(q.id)
    const question = typeof q.question === 'string' ? q.question.trim() : ''
    const why = typeof q.why === 'string' ? q.why.trim() : ''
    if (!Number.isInteger(id) || id < 1 || !question) continue
    questions.push({ id, question, why })
  }

  if (questions.length < 1) {
    throw new Error('runIntake: response contained no usable questions')
  }

  return { expanded, questions }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Re-export ModelResponse so IPC/preload can type-check result shapes without
// reaching into ../../ai.
export type { ModelResponse }
