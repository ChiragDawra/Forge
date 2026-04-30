// Phase 4 — Code generation.
// Implements the project files one by one using the context assembled by
// the context manager. Pauses for approval every APPROVAL_BATCH files so
// the user can review progress before continuing.

import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { writeProjectFile, projectRoot } from '../../tools/filesystem'
import { buildCodegenContext, renderContextBlock } from '../context-manager'
import { buildCodegenFilePrompt, buildCodegenPlanPrompt } from '../prompts/codegen'
import type { CallOptions } from '../../ai/types'

export interface CodegenFile {
  path: string
  description: string
  priority: 'high' | 'medium' | 'low'
  taskType: 'component' | 'page' | 'hook' | 'util' | 'ipc' | 'config'
}

export interface CodegenResult {
  filesWritten: number
  filesPlanned: number
  filesSkipped: number
  batchesCompleted: number
  totalCostUsd: number
  model: string
}

export type CodegenApprovalFn = (
  batchIndex: number,
  filesWritten: number,
  filesPlanned: number
) => Promise<boolean>

/** How many files per batch before pausing for approval */
const APPROVAL_BATCH = 5
/** Max total files to generate in one phase run */
const MAX_FILES = 40

/**
 * Run the codegen phase.
 *
 * @param projectId   - Forge project UUID
 * @param scaffoldSlug - slug used for the generated project root
 * @param onApproval  - async callback; return false to abort
 * @param log         - progress logging fn
 * @param opts        - AI call options (projectId for cost tracking)
 */
export async function runCodegen(
  projectId: string,
  scaffoldSlug: string,
  onApproval: CodegenApprovalFn,
  log: (msg: string) => void,
  opts: CallOptions = {}
): Promise<CodegenResult> {
  log('Building context window…')
  const ctx = await buildCodegenContext(projectId, scaffoldSlug)
  const contextBlock = renderContextBlock(ctx)
  log(`Context ready — ${ctx.totalChars} chars, ${ctx.existingFiles.length} scaffold files`)

  const root = projectRoot(scaffoldSlug)
  const done: string[] = []
  let filesWritten  = 0
  let filesSkipped  = 0
  let totalCost     = 0
  let model         = ''
  let batchIndex    = 0

  // ── Planning pass ────────────────────────────────────────────────────
  log('Planning implementation tasks…')
  const planResponse = await routeTask('codegen', buildCodegenPlanPrompt(contextBlock, done), opts)
  await logUsage(planResponse, opts)
  totalCost += planResponse.costUsd
  model      = planResponse.model

  const planned = parseTaskList(planResponse.content)
  log(`Planned ${planned.length} files to implement`)

  if (planned.length === 0) {
    log('No files planned — phase complete')
    return { filesWritten: 0, filesPlanned: 0, filesSkipped: 0, batchesCompleted: 0, totalCostUsd: totalCost, model }
  }

  // ── Batch loop ───────────────────────────────────────────────────────
  const queue = planned.slice(0, MAX_FILES)

  for (let i = 0; i < queue.length; i++) {
    const task = queue[i]

    // Approval gate every APPROVAL_BATCH files
    if (i > 0 && i % APPROVAL_BATCH === 0) {
      log(`Batch ${batchIndex + 1} complete (${filesWritten} files written). Waiting for approval…`)
      const approved = await onApproval(batchIndex, filesWritten, queue.length)
      if (!approved) {
        log('Codegen cancelled by user')
        break
      }
      batchIndex++
      log(`Batch ${batchIndex + 1} starting…`)
    }

    log(`Implementing ${task.path}…`)

    try {
      const filePrompt = buildCodegenFilePrompt(task.path, task.description, contextBlock)
      const response = await routeTask('codegen', filePrompt, opts)
      await logUsage(response, opts)
      totalCost += response.costUsd
      model      = response.model

      await writeProjectFile(root, task.path, response.content)
      done.push(task.path)
      filesWritten++
      log(`✓ ${task.path}`)
    } catch (err) {
      log(`✗ ${task.path}: ${err instanceof Error ? err.message : String(err)}`)
      filesSkipped++
    }
  }

  log(`Codegen complete: ${filesWritten} written, ${filesSkipped} skipped`)

  return {
    filesWritten,
    filesPlanned: planned.length,
    filesSkipped,
    batchesCompleted: batchIndex + 1,
    totalCostUsd: totalCost,
    model
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseTaskList(raw: string): CodegenFile[] {
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start < 0 || end < start) return []
  try {
    const arr = JSON.parse(raw.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    return arr.filter(isCodegenFile)
  } catch {
    return []
  }
}

function isCodegenFile(v: unknown): v is CodegenFile {
  if (typeof v !== 'object' || v === null) return false
  const f = v as Partial<CodegenFile>
  return (
    typeof f.path === 'string' && f.path.trim() !== '' &&
    typeof f.description === 'string' &&
    (f.priority === 'high' || f.priority === 'medium' || f.priority === 'low') &&
    typeof f.taskType === 'string'
  )
}
