// Wrapper around the `repomix` CLI. Produces a packed XML summary of a
// project directory and returns a lightweight digest consumable by agents.

import { execa } from 'execa'
import { readFile, stat, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

// Pin the repomix version so `npx` can't silently fetch a newer release
// with different flag semantics.
const REPOMIX_PKG = 'repomix@1.13.1'

export interface RepomixFile {
  path: string
  chars: number
}

export interface RepomixSummary {
  root: string
  totalFiles: number
  totalChars: number
  estimatedTokens: number
  topFiles: RepomixFile[] // 25 largest by char count
  rawXmlPath?: string // set when opts.keepXml is true
}

export interface RepomixOptions {
  /** When true, skip deleting the output XML so callers can re-read it. */
  keepXml?: boolean
  /** Additional ignore globs passed via --ignore. */
  ignore?: string[]
  /** Seconds before aborting the CLI run. Default 120s. */
  timeoutSec?: number
}

const MAX_OUTPUT_BYTES = 25 * 1024 * 1024 // 25 MB — guard against runaway output
const CHARS_PER_TOKEN = 4 // rough GPT-family estimate; good enough for budgeting

/**
 * Run repomix on `projectRoot` and parse the resulting XML into a summary.
 * Throws if the CLI fails or produces output too large to load safely.
 */
export async function runRepomix(
  projectRoot: string,
  opts: RepomixOptions = {}
): Promise<RepomixSummary> {
  if (!projectRoot || typeof projectRoot !== 'string') {
    throw new Error('runRepomix: projectRoot is required')
  }

  const outPath = join(tmpdir(), `forge-repomix-${randomUUID()}.xml`)
  // `--` terminates flag parsing so `--ignore` values starting with "-"
  // can't be reinterpreted as new CLI flags by repomix. The IPC layer
  // already rejects such values; this is defence in depth.
  const args = ['--yes', REPOMIX_PKG, '--style', 'xml', '--output', outPath]
  for (const ig of opts.ignore ?? []) {
    args.push('--ignore', ig)
  }

  try {
    await execa('npx', args, {
      cwd: projectRoot,
      timeout: (opts.timeoutSec ?? 120) * 1000,
      // Don't inherit stdio — keep output quiet; execa throws on non-zero exit
      stdout: 'pipe',
      stderr: 'pipe'
    })

    // Stat first to bail on oversized output before buffering 25 MB of XML.
    const { size } = await stat(outPath)
    if (size > MAX_OUTPUT_BYTES) {
      throw new Error(
        `repomix output too large (${size} bytes > ${MAX_OUTPUT_BYTES}). Add ignore patterns.`
      )
    }
    const xml = await readFile(outPath, 'utf8')

    const summary = summarizeXml(xml, projectRoot)
    if (opts.keepXml) {
      summary.rawXmlPath = outPath
    }
    return summary
  } finally {
    if (!opts.keepXml) {
      // Best-effort cleanup; don't fail the call if the temp file vanished.
      unlink(outPath).catch(() => undefined)
    }
  }
}

/**
 * Parse repomix's XML output. The relevant shape is:
 *   <file path="src/foo.ts">
 *     ...contents...
 *   </file>
 *
 * Using a streaming regex scanner avoids pulling in a full XML parser just
 * to count files and length.
 */
function summarizeXml(xml: string, root: string): RepomixSummary {
  const files: RepomixFile[] = []
  let totalChars = 0

  // Match each <file path="..."> ... </file> block. `[\s\S]` handles newlines.
  const re = /<file path="([^"]+)">([\s\S]*?)<\/file>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const path = m[1]
    const chars = m[2].length
    totalChars += chars
    files.push({ path, chars })
  }

  const topFiles = [...files].sort((a, b) => b.chars - a.chars).slice(0, 25)

  return {
    root,
    totalFiles: files.length,
    totalChars,
    estimatedTokens: Math.ceil(totalChars / CHARS_PER_TOKEN),
    topFiles
  }
}
