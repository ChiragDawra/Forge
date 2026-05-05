// Phase 5 — Code review.
// Iterates over generated source files and reviews each with the model.
// Produces a structured review report saved to review-report.json.

import { readFile, writeFile, readdir } from 'fs/promises'
import { join, extname } from 'path'
import { app } from 'electron'
import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { projectRoot } from '../../tools/filesystem'
import { buildReviewPrompt, buildReviewSummaryPrompt, type FileReview, type ReviewFinding } from '../prompts/review'
import type { CallOptions } from '../../ai/types'

export interface ReviewReport {
  reviewedAt: number
  filesReviewed: number
  totalFindings: number
  errorCount: number
  warningCount: number
  infoCount: number
  averageScore: number
  overallSummary: string
  fileReviews: FileReview[]
  model: string
  totalCostUsd: number
}

const REVIEWABLE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'])
const MAX_FILES_TO_REVIEW = 30

/**
 * Run the code review phase.
 * Reads source files from the scaffold root, reviews each one, and
 * persists a review-report.json under the project artefacts directory.
 */
export async function runReview(
  projectId: string,
  scaffoldSlug: string,
  log: (msg: string) => void,
  opts: CallOptions = {}
): Promise<ReviewReport> {
  const dir  = join(app.getPath('userData'), 'projects', projectId)
  const root = projectRoot(scaffoldSlug)

  // Collect reviewable files
  log('Collecting source files for review…')
  const files = await collectSourceFiles(root)
  const toReview = files.slice(0, MAX_FILES_TO_REVIEW)
  log(`Found ${files.length} source files — reviewing ${toReview.length}`)

  const fileReviews: FileReview[] = []
  let totalCost = 0
  let model = ''
  const allFindings: ReviewFinding[] = []

  for (const relPath of toReview) {
    log(`Reviewing ${relPath}…`)
    try {
      const absPath = join(root, relPath)
      const content = await readFile(absPath, 'utf8')
      const prompt  = buildReviewPrompt(relPath, content)

      const response = await routeTask('review', prompt, opts)
      await logUsage(response, opts)
      totalCost += response.costUsd
      model      = response.model

      const review = parseReview(response.content, relPath)
      fileReviews.push(review)
      allFindings.push(...review.findings)
      log(`✓ ${relPath} — score ${review.score}, ${review.findings.length} findings`)
    } catch (err) {
      log(`✗ ${relPath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Generate overall summary
  log('Generating overall review summary…')
  const summaryPrompt = buildReviewSummaryPrompt(toReview.length, allFindings)
  const summaryResponse = await routeTask('review', summaryPrompt, opts)
  await logUsage(summaryResponse, opts)
  totalCost += summaryResponse.costUsd

  const errorCount   = allFindings.filter((f) => f.severity === 'error').length
  const warningCount = allFindings.filter((f) => f.severity === 'warning').length
  const infoCount    = allFindings.filter((f) => f.severity === 'info').length
  const averageScore = fileReviews.length > 0
    ? Math.round(fileReviews.reduce((s, r) => s + r.score, 0) / fileReviews.length)
    : 0

  const report: ReviewReport = {
    reviewedAt: Date.now(),
    filesReviewed: toReview.length,
    totalFindings: allFindings.length,
    errorCount,
    warningCount,
    infoCount,
    averageScore,
    overallSummary: summaryResponse.content.trim(),
    fileReviews,
    model,
    totalCostUsd: totalCost
  }

  // Persist report
  const outPath = join(dir, 'review-report.json')
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8')
  log(`Review report saved to ${outPath}`)

  return report
}

// ── Helpers ──────────────────────────────────────────────────────────

async function collectSourceFiles(root: string, rel = ''): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(join(root, rel), { withFileTypes: true })
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        results.push(...await collectSourceFiles(root, relPath))
      } else if (REVIEWABLE_EXTS.has(extname(entry.name))) {
        results.push(relPath)
      }
    }
  } catch {
    // root may not exist yet
  }
  return results
}

function parseReview(raw: string, filePath: string): FileReview {
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1))
      if (
        typeof parsed.summary === 'string' &&
        Array.isArray(parsed.findings) &&
        typeof parsed.score === 'number'
      ) {
        return {
          file: filePath,
          summary: parsed.summary,
          findings: (parsed.findings as unknown[]).filter(isValidFinding),
          score: Math.max(0, Math.min(100, Math.round(parsed.score)))
        }
      }
    } catch {
      // fall through to empty review
    }
  }
  return { file: filePath, summary: 'Could not parse review', findings: [], score: 50 }
}

function isValidFinding(v: unknown): v is ReviewFinding {
  if (typeof v !== 'object' || v === null) return false
  const f = v as Partial<ReviewFinding>
  return (
    (f.line === null || typeof f.line === 'number') &&
    (f.severity === 'error' || f.severity === 'warning' || f.severity === 'info') &&
    typeof f.message === 'string' &&
    typeof f.suggestion === 'string'
  )
}
