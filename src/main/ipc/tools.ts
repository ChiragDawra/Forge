import { ipcMain } from 'electron'
import { statSync } from 'fs'
import { isAbsolute, resolve } from 'path'
import { runRepomix, type RepomixSummary } from '../tools/repomix'
import { fetchContext7Docs, type Context7Response } from '../tools/context7'
import {
  validateSender,
  checkRateLimit,
  assertSafeString,
  auditLog,
  safeErrorMessage
} from './security'

export function registerToolsIpc(): void {
  // ── Repomix: summarise a local project directory ──────────────────────
  ipcMain.handle(
    'tools:repomix',
    async (event, projectRoot: string, ignore?: string[]): Promise<RepomixSummary> => {
      try {
        validateSender(event)
        checkRateLimit('tools:repomix')
        assertSafeString(projectRoot, 'projectRoot', 1024)

        const safeRoot = assertSafeDirectory(projectRoot)
        const safeIgnore = Array.isArray(ignore)
          ? ignore
              .filter(
                (g): g is string =>
                  typeof g === 'string' &&
                  g.length > 0 &&
                  g.length < 200 &&
                  // Reject leading '-' so callers can't smuggle CLI flags
                  // (e.g. "--output /evil/path") as ignore values.
                  !g.startsWith('-')
              )
              .slice(0, 32)
          : []

        auditLog('tools:repomix', `root=${safeRoot} ignore=${safeIgnore.length}`)
        return await runRepomix(safeRoot, { ignore: safeIgnore })
      } catch (err) {
        auditLog('tools:repomix:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ── Context7: fetch up-to-date library docs ───────────────────────────
  ipcMain.handle(
    'tools:context7',
    async (
      event,
      library: string,
      topic?: string,
      tokens?: number
    ): Promise<Context7Response> => {
      try {
        validateSender(event)
        checkRateLimit('tools:context7')
        assertSafeString(library, 'library', 200)
        if (topic != null) assertSafeString(topic, 'topic', 200)

        auditLog('tools:context7', `lib=${library} topic=${topic ?? ''}`)
        return await fetchContext7Docs({ library, topic, tokens })
      } catch (err) {
        auditLog('tools:context7:error', safeErrorMessage(err))
        throw new Error(safeErrorMessage(err))
      }
    }
  )
}

/**
 * Validate that a caller-supplied directory is:
 *   - absolute (no CWD ambiguity)
 *   - free of `..` traversal after normalisation
 *   - an existing directory on disk
 * Returns the resolved path for safe downstream use.
 */
function assertSafeDirectory(input: string): string {
  if (!isAbsolute(input)) {
    throw new Error('projectRoot must be an absolute path')
  }
  const resolved = resolve(input)
  let stat
  try {
    stat = statSync(resolved)
  } catch {
    throw new Error('projectRoot does not exist')
  }
  if (!stat.isDirectory()) {
    throw new Error('projectRoot must be a directory')
  }
  return resolved
}
