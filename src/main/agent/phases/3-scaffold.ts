// Phase 3 — Scaffold.
// Uses Claude Base to turn the architecture folder-tree into actual
// files on disk. Produces stub files (empty or with a TODO comment)
// so downstream codegen has real targets to fill in.

import { routeTask } from '../../ai/router'
import { logUsage } from '../../ai/types'
import { projectRoot, writeProjectFile, listProjectTree, type FsTreeEntry } from '../../tools/filesystem'
import type { CallOptions } from '../../ai/types'
import type { ArchitectureJson } from '../../../preload/index.d'

export interface ScaffoldResult {
  slug: string
  root: string
  filesCreated: number
  tree: FsTreeEntry[]
  model: string
  costUsd: number
}

const SCAFFOLD_PROMPT = `You are scaffolding a new project. Given a folder tree from an architecture JSON, output a JSON array of files to create.

Each entry: { "path": string, "content": string }
- path is relative to project root (e.g. "src/index.ts")
- content is the initial file content (stub with TODO comment, or package.json/tsconfig etc)
- For TypeScript files: add "// TODO: implement" as body
- For package.json: generate a realistic one based on the stack
- For tsconfig.json: generate a standard config
- For README.md: generate a project overview
- Include: package.json, tsconfig.json, README.md, .gitignore, and all src/ stubs

Return ONLY a JSON array. No prose.`

export async function runScaffold(
  projectName: string,
  architecture: ArchitectureJson,
  opts: CallOptions = {}
): Promise<ScaffoldResult> {
  if (!projectName?.trim()) throw new Error('runScaffold: projectName is required')

  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
  const root = projectRoot(slug)

  const prompt = `${SCAFFOLD_PROMPT}\n\n---\nProject: ${projectName}\nStack: ${JSON.stringify(architecture.stack)}\nFolder tree:\n${JSON.stringify(architecture.folderTree, null, 2)}\n\nReturn only JSON array.`

  const response = await routeTask('codegen', prompt, opts)
  await logUsage(response, opts)

  const files = parseFileList(response.content)
  let filesCreated = 0

  for (const f of files.slice(0, 100)) {
    try {
      await writeProjectFile(root, f.path, f.content)
      filesCreated++
    } catch (err) {
      console.warn(`[scaffold] skip ${f.path}:`, err instanceof Error ? err.message : err)
    }
  }

  const tree = await listProjectTree(root)

  return {
    slug,
    root,
    filesCreated,
    tree,
    model: response.model,
    costUsd: response.costUsd
  }
}

function parseFileList(raw: string): { path: string; content: string }[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end < start) return []
  try {
    const arr = JSON.parse(raw.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (f): f is { path: string; content: string } =>
        typeof f?.path === 'string' &&
        f.path.trim() !== '' &&
        typeof f?.content === 'string'
    )
  } catch {
    return []
  }
}
