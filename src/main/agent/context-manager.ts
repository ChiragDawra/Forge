// Context manager — assembles the right context window for codegen tasks.
// Pulls in the PRD, architecture, design brief, and relevant existing files
// so the model always has enough signal to write correct code.

import { readFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { listProjectTree, projectRoot } from '../tools/filesystem'
import type { ArchitectureJson } from '../../preload/index.d'

export interface CodegenContext {
  prd: string
  architecture: ArchitectureJson
  designBrief: string
  components: string          // JSON string of ui-components
  existingFiles: string[]     // relative paths already on disk
  totalChars: number
}

const MAX_PRD_CHARS      = 3_000
const MAX_BRIEF_CHARS    = 2_000
const MAX_COMP_CHARS     = 2_000
const MAX_ARCH_CHARS     = 2_000

/**
 * Load and assemble all project artefacts needed for codegen.
 * Truncates each piece to keep the context window manageable.
 */
export async function buildCodegenContext(
  projectId: string,
  scaffoldSlug: string
): Promise<CodegenContext> {
  const dir = join(app.getPath('userData'), 'projects', projectId)

  // Load all artefacts in parallel; gracefully degrade if any are missing
  const [prdRaw, archRaw, briefRaw, compRaw] = await Promise.allSettled([
    readFile(join(dir, 'prd.md'), 'utf8'),
    readFile(join(dir, 'architecture.json'), 'utf8'),
    readFile(join(dir, 'design-brief.md'), 'utf8'),
    readFile(join(dir, 'ui-components.json'), 'utf8')
  ])

  const prd      = prdRaw.status      === 'fulfilled' ? prdRaw.value.slice(0, MAX_PRD_CHARS)   : ''
  const archJson = archRaw.status     === 'fulfilled' ? archRaw.value.slice(0, MAX_ARCH_CHARS) : '{}'
  const brief    = briefRaw.status    === 'fulfilled' ? briefRaw.value.slice(0, MAX_BRIEF_CHARS) : ''
  const compJson = compRaw.status     === 'fulfilled' ? compRaw.value.slice(0, MAX_COMP_CHARS)  : '[]'

  let architecture: ArchitectureJson
  try {
    architecture = JSON.parse(archJson)
  } catch {
    architecture = {
      stack: { frontend: '', backend: '', database: '', auth: '', hosting: '', other: [] },
      folderTree: [],
      keyDecisions: [],
      phases: []
    }
  }

  // List scaffold tree so codegen knows what files exist
  let existingFiles: string[] = []
  try {
    const root = projectRoot(scaffoldSlug)
    const tree = await listProjectTree(root, 3)
    existingFiles = tree.filter((e) => e.type === 'file').map((e) => e.path)
  } catch {
    // scaffold not yet created — fine
  }

  const totalChars = prd.length + archJson.length + brief.length + compJson.length

  return {
    prd,
    architecture,
    designBrief: brief,
    components: compJson,
    existingFiles,
    totalChars
  }
}

/**
 * Render a compact context block for injection into codegen prompts.
 */
export function renderContextBlock(ctx: CodegenContext): string {
  return [
    ctx.prd      ? `### PRD (excerpt)\n${ctx.prd}`                    : '',
    ctx.designBrief ? `### Design Brief (excerpt)\n${ctx.designBrief}` : '',
    ctx.components  ? `### UI Components\n${ctx.components}`            : '',
    ctx.existingFiles.length
      ? `### Existing scaffold files (${ctx.existingFiles.length})\n${ctx.existingFiles.slice(0, 60).join('\n')}`
      : ''
  ].filter(Boolean).join('\n\n---\n\n')
}
