// npm-audit tool — runs `npm audit --json` in the project root and
// returns a structured summary of dependency vulnerabilities.

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export interface NpmVulnerability {
  name: string
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info'
  via: string[]
  fixAvailable: boolean
  range: string
}

export interface NpmAuditResult {
  ran: boolean
  vulnerabilities: NpmVulnerability[]
  totalVulnerabilities: number
  critical: number
  high: number
  moderate: number
  low: number
  info: number
  rawOutput?: string
  error?: string
}

/**
 * Run `npm audit --json` in the given directory.
 * Gracefully handles projects without package.json or npm not available.
 */
export async function runNpmAudit(projectRoot: string): Promise<NpmAuditResult> {
  const pkgPath = join(projectRoot, 'package.json')

  if (!existsSync(pkgPath)) {
    return {
      ran: false,
      vulnerabilities: [],
      totalVulnerabilities: 0,
      critical: 0, high: 0, moderate: 0, low: 0, info: 0,
      error: 'No package.json found — skipping npm audit'
    }
  }

  try {
    const { stdout } = await execAsync('npm audit --json', {
      cwd: projectRoot,
      timeout: 30_000
    })
    return parseAuditOutput(stdout)
  } catch (err: unknown) {
    // npm audit exits with non-zero when vulnerabilities are found
    const execErr = err as { stdout?: string; stderr?: string; message?: string }
    if (execErr.stdout) {
      return parseAuditOutput(execErr.stdout)
    }
    return {
      ran: false,
      vulnerabilities: [],
      totalVulnerabilities: 0,
      critical: 0, high: 0, moderate: 0, low: 0, info: 0,
      error: execErr.message ?? String(err)
    }
  }
}

function parseAuditOutput(raw: string): NpmAuditResult {
  try {
    const data = JSON.parse(raw)
    const vulns: NpmVulnerability[] = []

    // npm audit v7+ JSON shape
    const metadata = data?.metadata?.vulnerabilities ?? {}
    const critical = metadata.critical ?? 0
    const high     = metadata.high ?? 0
    const moderate = metadata.moderate ?? 0
    const low      = metadata.low ?? 0
    const info     = metadata.info ?? 0
    const total    = critical + high + moderate + low + info

    if (data.vulnerabilities) {
      for (const [name, vuln] of Object.entries(data.vulnerabilities as Record<string, unknown>)) {
        const v = vuln as Record<string, unknown>
        vulns.push({
          name,
          severity: (v.severity as NpmVulnerability['severity']) ?? 'low',
          via: Array.isArray(v.via) ? (v.via as string[]).filter((x) => typeof x === 'string') : [],
          fixAvailable: Boolean(v.fixAvailable),
          range: String(v.range ?? '*')
        })
      }
    }

    return {
      ran: true,
      vulnerabilities: vulns,
      totalVulnerabilities: total,
      critical, high, moderate, low, info,
      rawOutput: raw.slice(0, 2000)
    }
  } catch {
    return {
      ran: true,
      vulnerabilities: [],
      totalVulnerabilities: 0,
      critical: 0, high: 0, moderate: 0, low: 0, info: 0,
      rawOutput: raw.slice(0, 500),
      error: 'Failed to parse npm audit output'
    }
  }
}
