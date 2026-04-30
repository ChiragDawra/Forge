// Filesystem tool — wraps Node fs/promises for safe, project-scoped
// file operations. Keeps generated projects isolated under
// <app>/generated-projects/<slug>/. No writes outside that root.

import { mkdir, writeFile, readFile, readdir, stat, rm } from 'fs/promises'
import { join, resolve, relative, isAbsolute, extname } from 'path'
import { app } from 'electron'

const GENERATED_ROOT = (): string =>
  join(app.getPath('userData'), 'generated-projects')

// Safe extensions for code generation — reject binaries, hidden dirs, etc.
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html',
  '.env', '.env.example', '.gitignore', '.prettierrc', '.eslintrc',
  '.yml', '.yaml', '.toml', '.txt', '.svg', ''
])

export interface FsWriteResult {
  path: string
  bytes: number
}

export interface FsTreeEntry {
  path: string
  type: 'file' | 'dir'
  size?: number
}

/**
 * Return the absolute root for a project slug.
 * Throws if the slug is unsafe (traversal, hidden, etc.).
 */
export function projectRoot(slug: string): string {
  if (!slug || typeof slug !== 'string') throw new Error('slug is required')
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(slug)) {
    throw new Error(`Invalid project slug: "${slug}"`)
  }
  return join(GENERATED_ROOT(), slug)
}

/**
 * Validate that a caller-supplied relative path is safe to write:
 *   - must be relative (no leading /)
 *   - must not escape the root after resolution
 *   - must have an allowed extension
 * Returns the resolved absolute path.
 */
export function safePath(root: string, relPath: string): string {
  if (isAbsolute(relPath)) throw new Error('path must be relative')
  const abs = resolve(join(root, relPath))
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('path traversal detected')
  }
  const ext = extname(abs).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Disallowed file extension: "${ext}"`)
  }
  return abs
}

/** Write a single file, creating parent dirs as needed. */
export async function writeProjectFile(
  root: string,
  relPath: string,
  content: string
): Promise<FsWriteResult> {
  const abs = safePath(root, relPath)
  await mkdir(join(abs, '..'), { recursive: true })
  const buf = Buffer.from(content, 'utf8')
  await writeFile(abs, buf)
  return { path: abs, bytes: buf.byteLength }
}

/** Read a file, returns null if it doesn't exist. */
export async function readProjectFile(
  root: string,
  relPath: string
): Promise<string | null> {
  try {
    const abs = safePath(root, relPath)
    return await readFile(abs, 'utf8')
  } catch {
    return null
  }
}

/** Recursively list files under root (depth-limited to 4). */
export async function listProjectTree(
  root: string,
  maxDepth = 4
): Promise<FsTreeEntry[]> {
  const entries: FsTreeEntry[] = []
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    let items: string[]
    try { items = await readdir(dir) } catch { return }
    for (const item of items) {
      if (item.startsWith('.') && item !== '.env.example') continue
      const abs = join(dir, item)
      const rel = relative(root, abs)
      try {
        const s = await stat(abs)
        if (s.isDirectory()) {
          entries.push({ path: rel, type: 'dir' })
          await walk(abs, depth + 1)
        } else {
          entries.push({ path: rel, type: 'file', size: s.size })
        }
      } catch { /* skip */ }
    }
  }
  await walk(root, 0)
  return entries
}

/** Remove a project directory. Slug validation prevents escaping root. */
export async function deleteProject(slug: string): Promise<void> {
  const root = projectRoot(slug)
  await rm(root, { recursive: true, force: true })
}
