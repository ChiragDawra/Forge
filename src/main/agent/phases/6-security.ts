// Phase 6 — Security audit.
// Combines:
//   1. Static analysis — model reviews each source file for vulnerabilities
//   2. Dependency audit — npm audit to catch known CVEs
// Produces security-report.json under the project artefacts directory.

import { readFile, writeFile, readdir } from 'fs/promises'
import { join, extname } from 'path'
import { app } from 'electron'
import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { projectRoot } from '../../tools/filesystem'
import { runNpmAudit, type NpmAuditResult } from '../../tools/npm-audit'
import {
  buildSecurityPrompt,
  buildSecuritySummaryPrompt,
  type FileSecurityResult,
  type SecurityFinding
} from '../prompts/security'
import type { CallOptions } from '../../ai/types'

export interface SecurityReport {
  auditedAt: number
  filesScanned: number
  totalFindings: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
  overallRiskScore: number
  executiveSummary: string
  fileResults: FileSecurityResult[]
  npmAudit: NpmAuditResult
  model: string
  totalCostUsd: number
}

const SCANNABLE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'])
const MAX_FILES_TO_SCAN = 25

export async function runSecurity(
  projectId: string,
  scaffoldSlug: string,
  log: (msg: string) => void,
  opts: CallOptions = {}
): Promise<SecurityReport> {
  const dir  = join(app.getPath('userData'), 'projects', projectId)
  const root = projectRoot(scaffoldSlug)

  // ── npm audit ─────────────────────────────────────────────────────────
  log('Running npm audit…')
  const npmAudit = await runNpmAudit(root)
  if (npmAudit.ran) {
    log(`npm audit: ${npmAudit.totalVulnerabilities} vulnerabilities (${npmAudit.critical} critical, ${npmAudit.high} high)`)
  } else {
    log(`npm audit skipped: ${npmAudit.error ?? 'no package.json'}`)
  }

  // ── Static analysis ───────────────────────────────────────────────────
  log('Collecting source files for security scan…')
  const files = await collectSourceFiles(root)
  const toScan = files.slice(0, MAX_FILES_TO_SCAN)
  log(`Found ${files.length} source files — scanning ${toScan.length}`)

  const fileResults: FileSecurityResult[] = []
  let totalCost = 0
  let model = ''
  const allFindings: SecurityFinding[] = []

  for (const relPath of toScan) {
    log(`Scanning ${relPath}…`)
    try {
      const content = await readFile(join(root, relPath), 'utf8')
      const prompt  = buildSecurityPrompt(relPath, content)

      const response = await routeTask('security', prompt, opts)
      await logUsage(response, opts)
      totalCost += response.costUsd
      model      = response.model

      const result = parseFileResult(response.content, relPath)
      fileResults.push(result)
      allFindings.push(...result.findings)
      const serious = result.findings.filter((f) => f.severity === 'critical' || f.severity === 'high')
      log(`✓ ${relPath} — risk ${result.riskScore}, ${serious.length} critical/high`)
    } catch (err) {
      log(`✗ ${relPath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Executive summary ─────────────────────────────────────────────────
  log('Generating executive summary…')
  const criticalCount = allFindings.filter((f) => f.severity === 'critical').length
  const highCount     = allFindings.filter((f) => f.severity === 'high').length
  const mediumCount   = allFindings.filter((f) => f.severity === 'medium').length
  const lowCount      = allFindings.filter((f) => f.severity === 'low').length
  const infoCount     = allFindings.filter((f) => f.severity === 'info').length

  const summaryResponse = await routeTask(
    'security',
    buildSecuritySummaryPrompt(toScan.length, criticalCount, highCount, npmAudit.totalVulnerabilities),
    opts
  )
  await logUsage(summaryResponse, opts)
  totalCost += summaryResponse.costUsd

  const avgRisk = fileResults.length > 0
    ? Math.round(fileResults.reduce((s, r) => s + r.riskScore, 0) / fileResults.length)
    : 0

  const report: SecurityReport = {
    auditedAt: Date.now(),
    filesScanned: toScan.length,
    totalFindings: allFindings.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    overallRiskScore: avgRisk,
    executiveSummary: summaryResponse.content.trim(),
    fileResults,
    npmAudit,
    model,
    totalCostUsd: totalCost
  }

  const outPath = join(dir, 'security-report.json')
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8')
  log(`Security report saved to ${outPath}`)

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
      } else if (SCANNABLE_EXTS.has(extname(entry.name))) {
        results.push(relPath)
      }
    }
  } catch { /* root not yet created */ }
  return results
}

function parseFileResult(raw: string, filePath: string): FileSecurityResult {
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1))
      if (Array.isArray(parsed.findings) && typeof parsed.riskScore === 'number') {
        return {
          file: filePath,
          findings: (parsed.findings as unknown[]).filter(isValidFinding),
          riskScore: Math.max(0, Math.min(100, Math.round(parsed.riskScore)))
        }
      }
    } catch { /* fall through */ }
  }
  return { file: filePath, findings: [], riskScore: 0 }
}

function isValidFinding(v: unknown): v is SecurityFinding {
  if (typeof v !== 'object' || v === null) return false
  const f = v as Partial<SecurityFinding>
  return (
    (f.line === null || typeof f.line === 'number') &&
    typeof f.severity === 'string' &&
    typeof f.title === 'string' &&
    typeof f.description === 'string' &&
    typeof f.recommendation === 'string'
  )
}
