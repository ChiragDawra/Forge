// Phase 8 — Deploy.
// Deploys the generated project to Vercel as a preview deployment.
// Requires VERCEL_TOKEN in the OS keychain (settings key: "vercel_token")
// or the VERCEL_TOKEN environment variable.

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { projectRoot } from '../../tools/filesystem'
import { deployToVercel, type VercelDeployResult } from '../../tools/vercel'
import type { CallOptions } from '../../ai/types'

export interface DeployReport {
  deployedAt: number
  success: boolean
  url?: string
  projectName: string
  environment: 'production' | 'preview'
  durationMs: number
  output: string
  error?: string
}

export async function runDeploy(
  projectId: string,
  scaffoldSlug: string,
  projectName: string,
  log: (msg: string) => void,
  _opts: CallOptions = {}
): Promise<DeployReport> {
  const dir  = join(app.getPath('userData'), 'projects', projectId)
  const root = projectRoot(scaffoldSlug)

  // Try to read Vercel token from keychain via settings
  let token: string | undefined
  try {
    const keytar = await import('keytar')
    const stored = await keytar.getPassword('forge', 'vercel_token')
    if (stored) token = stored
  } catch {
    // keytar not available — fall back to env var
  }

  if (!token && !process.env.VERCEL_TOKEN) {
    log('No VERCEL_TOKEN found in keychain or environment — deploying without token (public projects only)')
  } else {
    log('Vercel token found — deploying…')
  }

  log(`Deploying ${projectName} to Vercel (preview)…`)

  const result: VercelDeployResult = await deployToVercel(root, {
    token,
    production: false,
    projectName: scaffoldSlug
  })

  const durationSec = (result.durationMs / 1000).toFixed(1)
  if (result.success) {
    log(`✓ Deployed in ${durationSec}s → ${result.url}`)
  } else {
    log(`✗ Deploy failed: ${result.error ?? 'unknown error'}`)
    log('Tip: Set your Vercel token in Settings → API Keys → Vercel Token')
  }

  const report: DeployReport = {
    deployedAt: Date.now(),
    success:     result.success,
    url:         result.url,
    projectName: scaffoldSlug,
    environment: result.environment,
    durationMs:  result.durationMs,
    output:      result.output,
    error:       result.error
  }

  const outPath = join(dir, 'deploy-report.json')
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8')
  log(`Deploy report saved to ${outPath}`)

  return report
}
