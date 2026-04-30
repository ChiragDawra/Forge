// Phase 2 — Design.
// Generates a design brief (for Stitch/v0) and a component map.
// The brief is markdown; the component map is extracted JSON.
// The user copies the brief into their AI design tool, pastes the
// result back via the UI, and we extract the component list.

import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { buildDesignUserPrompt } from '../prompts/design'
import type { CallOptions } from '../../ai/types'

export interface DesignComponent {
  name: string
  path: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

export interface DesignResult {
  brief: string
  components: DesignComponent[]
  model: string
  costUsd: number
}

const MAX_LEN = 20_000

export async function runDesign(
  prd: string,
  archJson: string,
  opts: CallOptions = {}
): Promise<DesignResult> {
  if (!prd?.trim()) throw new Error('runDesign: prd is required')

  const prompt = buildDesignUserPrompt(
    prd.trim().slice(0, MAX_LEN),
    archJson.trim().slice(0, MAX_LEN)
  )

  const response = await routeTask('planning', prompt, opts)
  await logUsage(response, opts)

  const { brief, components } = parseDesignResponse(response.content)

  return {
    brief,
    components,
    model: response.model,
    costUsd: response.costUsd
  }
}

function parseDesignResponse(raw: string): { brief: string; components: DesignComponent[] } {
  // Split at the JSON object — brief is everything before the first `{`
  const jsonStart = raw.indexOf('{')
  const brief = (jsonStart > 0 ? raw.slice(0, jsonStart) : raw).trim()

  let components: DesignComponent[] = []
  if (jsonStart >= 0) {
    const jsonEnd = raw.lastIndexOf('}')
    try {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
      if (Array.isArray(parsed?.components)) {
        components = parsed.components
          .filter(
            (c: unknown): c is DesignComponent =>
              isRecord(c) &&
              typeof c.name === 'string' && c.name.trim() !== '' &&
              typeof c.path === 'string' && c.path.trim() !== '' &&
              typeof c.description === 'string'
          )
          .map((c) => ({
            name: c.name.trim(),
            path: c.path.trim(),
            description: c.description.trim(),
            priority: (['high', 'medium', 'low'] as const).includes(c.priority as 'high')
              ? (c.priority as DesignComponent['priority'])
              : 'medium'
          }))
          .slice(0, 60)
      }
    } catch {
      // JSON parse failed — return whatever brief we got, empty component list
    }
  }

  return { brief, components }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
