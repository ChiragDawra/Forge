import { randomUUID } from 'crypto'
import { getDb } from '../db/client'
import { modelUsage } from '../db/schema'

// ─── Shared types ───────────────────────────────────────────────────────────

export type ModelName = 'claude-opus-4-6' | 'claude-sonnet-4-5' | 'gemini-2.0-flash'

export interface CallOptions {
  projectId?: string
  phaseId?: string
}

export interface ModelResponse {
  content: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  model: ModelName
}

// ─── Cost per 1M tokens (USD) ───────────────────────────────────────────────

const COSTS: Record<ModelName, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 }
}

export function computeCost(model: ModelName, inputTokens: number, outputTokens: number): number {
  const rate = COSTS[model]
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output
}

// ─── Usage logger ───────────────────────────────────────────────────────────

export async function logUsage(
  response: ModelResponse,
  opts: CallOptions = {}
): Promise<void> {
  try {
    const db = getDb()
    await db.insert(modelUsage).values({
      id: randomUUID(),
      projectId: opts.projectId ?? null,
      phaseId: opts.phaseId ?? null,
      modelName: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costUsd: response.costUsd,
      calledAt: new Date()
    })
  } catch (err) {
    // Log warning but never crash the caller for a usage-tracking failure
    console.warn('[AI] Failed to log usage:', err instanceof Error ? err.message : err)
  }
}
