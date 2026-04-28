// Phase 1 — Planning.
// Consumes intake.json and produces two artefacts:
//   prd.md          — long-form product requirements doc  (Gemini Flash)
//   architecture.json — stack + folder tree + key decisions (Claude Base)
//
// Both run in parallel to save latency. Neither is persisted here —
// the IPC handler writes them to disk under <userData>/projects/<id>/.
// That keeps this module pure and testable.

import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { buildPrdUserPrompt } from '../prompts/prd'
import { buildArchitectureUserPrompt } from '../prompts/architecture'
import type { CallOptions } from '../../ai/types'

// ── Input / output types ─────────────────────────────────────────────

export interface PlanningInput {
  expanded: string
  clarifications: { question: string; answer: string }[]
}

export interface ArchStack {
  frontend: string
  backend: string
  database: string
  auth: string
  hosting: string
  other: string[]
}

export interface ArchFolderEntry {
  path: string
  description: string
}

export interface ArchDecision {
  decision: string
  rationale: string
}

export interface ArchPhase {
  name: string
  description: string
  order: number
}

export interface ArchitectureJson {
  stack: ArchStack
  folderTree: ArchFolderEntry[]
  keyDecisions: ArchDecision[]
  phases: ArchPhase[]
}

export interface PlanningResult {
  prd: string
  architecture: ArchitectureJson
  prdModel: string
  archModel: string
  totalCostUsd: number
}

const MAX_INPUT_LEN = 20_000

// ── Main export ──────────────────────────────────────────────────────

/**
 * Run phase 1. Both model calls are fired in parallel; the caller
 * receives a single settled result or a thrown error if either fails.
 */
export async function runPlanning(
  input: PlanningInput,
  opts: CallOptions = {}
): Promise<PlanningResult> {
  if (!input?.expanded?.trim()) {
    throw new Error('runPlanning: expanded brief is required')
  }
  const safe: PlanningInput = {
    expanded: input.expanded.trim().slice(0, MAX_INPUT_LEN),
    clarifications: (input.clarifications ?? [])
      .filter(
        (c): c is { question: string; answer: string } =>
          typeof c?.question === 'string' && typeof c?.answer === 'string'
      )
      .slice(0, 20)
  }

  const prdPrompt = buildPrdUserPrompt(safe)

  // PRD first, then architecture (needs PRD for grounding)
  const prdResponse = await routeTask('planning', prdPrompt, opts)
  await logUsage(prdResponse, opts)

  const archPrompt = buildArchitectureUserPrompt(safe, prdResponse.content)
  const archResponse = await routeTask('codegen', archPrompt, opts)
  await logUsage(archResponse, opts)

  const architecture = parseArchitecture(archResponse.content)

  return {
    prd: prdResponse.content.trim(),
    architecture,
    prdModel: prdResponse.model,
    archModel: archResponse.model,
    totalCostUsd: prdResponse.costUsd + archResponse.costUsd
  }
}

// ── JSON parser ──────────────────────────────────────────────────────

function parseArchitecture(raw: string): ArchitectureJson {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new Error('runPlanning: architecture model did not return JSON')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch (err) {
    throw new Error(`runPlanning: invalid JSON — ${(err as Error).message}`)
  }

  if (!isRecord(parsed)) throw new Error('runPlanning: architecture response is not an object')

  // ── stack ──
  const rawStack = isRecord(parsed.stack) ? parsed.stack : {}
  const stack: ArchStack = {
    frontend: str(rawStack.frontend),
    backend: str(rawStack.backend),
    database: str(rawStack.database),
    auth: str(rawStack.auth),
    hosting: str(rawStack.hosting),
    other: Array.isArray(rawStack.other)
      ? rawStack.other.filter((x): x is string => typeof x === 'string').slice(0, 10)
      : []
  }

  // ── folderTree ──
  const folderTree: ArchFolderEntry[] = Array.isArray(parsed.folderTree)
    ? parsed.folderTree
        .filter(isRecord)
        .map((e) => ({ path: str(e.path), description: str(e.description) }))
        .filter((e) => e.path)
        .slice(0, 50)
    : []

  // ── keyDecisions ──
  const keyDecisions: ArchDecision[] = Array.isArray(parsed.keyDecisions)
    ? parsed.keyDecisions
        .filter(isRecord)
        .map((d) => ({ decision: str(d.decision), rationale: str(d.rationale) }))
        .filter((d) => d.decision)
        .slice(0, 10)
    : []

  // ── phases ──
  const phases: ArchPhase[] = Array.isArray(parsed.phases)
    ? parsed.phases
        .filter(isRecord)
        .map((p) => ({
          name: str(p.name),
          description: str(p.description),
          order: Number.isInteger(Number(p.order)) ? Number(p.order) : 0
        }))
        .filter((p) => p.name)
        .sort((a, b) => a.order - b.order)
        .slice(0, 20)
    : []

  return { stack, folderTree, keyDecisions, phases }
}

// ── Helpers ──────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
