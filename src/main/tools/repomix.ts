import { execa } from 'execa'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// ─── Types ──────────────────────────────────────────────────────

export interface RepomixResult {
  xml: string
  files: RepomixFile[]
  summary: { totalFiles: number; totalLines: number }
}

export interface RepomixFile {
  path: string
  content: string
}

// ─── Runner ─────────────────────────────────────────────────────

/**
 * Run repomix on a directory and parse the XML output.
 * Writes to a temp file to avoid stdout size limits.
 */
export async function runRepomix(
  targetDir: string,
  opts: { include?: string; ignore?: string } = {}
): Promise<RepomixResult> {
  if (!existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`)
  }

  const tmp = await mkdtemp(join(tmpdir(), 'forge-repomix-'))
  const outPath = join(tmp, 'output.xml')

  try {
    const args = ['--output', outPath, '--style', 'xml']
    if (opts.include) args.push('--include', opts.include)
    if (opts.ignore) args.push('--ignore', opts.ignore)

    await execa('repomix', args, {
      cwd: targetDir,
      timeout: 60_000,
      reject: true
    })

    const xml = await readFile(outPath, 'utf-8')
    const files = parseRepomixXml(xml)
    const totalLines = files.reduce(
      (sum, f) => sum + f.content.split('\n').length,
      0
    )

    return {
      xml,
      files,
      summary: { totalFiles: files.length, totalLines }
    }
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

// ─── Parser ─────────────────────────────────────────────────────

const FILE_RE = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g

function parseRepomixXml(xml: string): RepomixFile[] {
  const files: RepomixFile[] = []
  let match: RegExpExecArray | null

  while ((match = FILE_RE.exec(xml)) !== null) {
    files.push({
      path: match[1],
      content: match[2].trim()
    })
  }

  return files
}

/**
 * Run repomix and save the raw XML to a file path.
 * Returns the parsed result alongside saving for later use.
 */
export async function repomixToFile(
  targetDir: string,
  savePath: string,
  opts: { include?: string; ignore?: string } = {}
): Promise<RepomixResult> {
  const result = await runRepomix(targetDir, opts)
  await writeFile(savePath, result.xml, 'utf-8')
  return result
}
