// Vercel deploy tool.
// Uses the Vercel CLI (`npx vercel`) to deploy the generated project.
// Reads the VERCEL_TOKEN from the OS keychain (keytar) if available,
// otherwise falls back to the VERCEL_TOKEN environment variable.

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export interface VercelDeployResult {
  success: boolean
  url?: string
  projectName?: string
  environment: 'production' | 'preview'
  durationMs: number
  output: string
  error?: string
}

/**
 * Deploy the project at `projectRoot` to Vercel.
 * Returns a structured result regardless of success/failure.
 */
export async function deployToVercel(
  projectRoot: string,
  options: {
    token?: string
    production?: boolean
    projectName?: string
  } = {}
): Promise<VercelDeployResult> {
  const start = Date.now()

  if (!existsSync(projectRoot)) {
    return {
      success: false,
      environment: 'preview',
      durationMs: 0,
      output: '',
      error: 'Project root not found'
    }
  }

  // Resolve token: explicit > env var
  const token = options.token ?? process.env.VERCEL_TOKEN

  // Build CLI command
  const flags: string[] = ['--no-clipboard', '--yes']
  if (token) flags.push(`--token=${token}`)
  if (options.production) flags.push('--prod')
  if (options.projectName) flags.push(`--name=${sanitizeProjectName(options.projectName)}`)

  const cmd = `npx vercel ${flags.join(' ')}`

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projectRoot,
      timeout: 120_000,
      env: { ...process.env, ...(token ? { VERCEL_TOKEN: token } : {}) }
    })
    const durationMs = Date.now() - start
    const combined   = stdout + stderr
    const url        = extractUrl(combined)

    return {
      success: true,
      url,
      projectName: options.projectName,
      environment: options.production ? 'production' : 'preview',
      durationMs,
      output: combined.slice(0, 2000)
    }
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string }
    const durationMs = Date.now() - start
    const output = ((execErr.stdout ?? '') + (execErr.stderr ?? '')).slice(0, 2000)

    // Check if the deploy actually succeeded despite non-zero exit
    const url = extractUrl(output)
    if (url) {
      return {
        success: true,
        url,
        projectName: options.projectName,
        environment: options.production ? 'production' : 'preview',
        durationMs,
        output
      }
    }

    return {
      success: false,
      environment: options.production ? 'production' : 'preview',
      durationMs,
      output,
      error: execErr.message ?? 'vercel deploy failed'
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractUrl(output: string): string | undefined {
  // Match https://*.vercel.app or https://<project>.vercel.app
  const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app[^\s]*/i)
  return match?.[0]
}

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52) // Vercel name limit
}
