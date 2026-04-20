import { ipcMain } from 'electron'
import { validateSender, checkRateLimit, assertSafeString, safeErrorMessage, auditLog } from './security'
import { runRepomix, repomixToFile } from '../tools/repomix'
import { resolveLibrary, getLibraryDocs, lookupDocs } from '../tools/context7'

export function registerToolsIpc(): void {
  // ─── Repomix ────────────────────────────────────────────────

  ipcMain.handle('tools:repomix', async (event, targetDir: unknown, include?: unknown, ignore?: unknown) => {
    validateSender(event)
    checkRateLimit('tools:repomix')
    assertSafeString(targetDir, 'targetDir', 1024)
    if (include !== undefined) assertSafeString(include, 'include', 512)
    if (ignore !== undefined) assertSafeString(ignore, 'ignore', 512)
    auditLog('tools:repomix', targetDir as string)

    try {
      const result = await runRepomix(targetDir as string, {
        include: include as string | undefined,
        ignore: ignore as string | undefined
      })
      return { files: result.files, summary: result.summary }
    } catch (err) {
      throw new Error(safeErrorMessage(err))
    }
  })

  ipcMain.handle(
    'tools:repomix-to-file',
    async (event, targetDir: unknown, savePath: unknown, include?: unknown, ignore?: unknown) => {
      validateSender(event)
      checkRateLimit('tools:repomix-to-file')
      assertSafeString(targetDir, 'targetDir', 1024)
      assertSafeString(savePath, 'savePath', 1024)
      if (include !== undefined) assertSafeString(include, 'include', 512)
      if (ignore !== undefined) assertSafeString(ignore, 'ignore', 512)
      auditLog('tools:repomix-to-file', `${targetDir} → ${savePath}`)

      try {
        const result = await repomixToFile(targetDir as string, savePath as string, {
          include: include as string | undefined,
          ignore: ignore as string | undefined
        })
        return { summary: result.summary }
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  // ─── Context7 ───────────────────────────────────────────────

  ipcMain.handle('tools:context7-resolve', async (event, libraryName: unknown) => {
    validateSender(event)
    checkRateLimit('tools:context7-resolve')
    assertSafeString(libraryName, 'libraryName', 256)
    auditLog('tools:context7-resolve', libraryName as string)

    try {
      return await resolveLibrary(libraryName as string)
    } catch (err) {
      throw new Error(safeErrorMessage(err))
    }
  })

  ipcMain.handle(
    'tools:context7-docs',
    async (event, libraryId: unknown, topic: unknown, maxTokens?: unknown) => {
      validateSender(event)
      checkRateLimit('tools:context7-docs')
      assertSafeString(libraryId, 'libraryId', 256)
      assertSafeString(topic, 'topic', 512)
      auditLog('tools:context7-docs', `${libraryId} — ${topic}`)

      try {
        const tokens = typeof maxTokens === 'number' ? maxTokens : undefined
        return await getLibraryDocs(libraryId as string, topic as string, { maxTokens: tokens })
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    }
  )

  ipcMain.handle(
    'tools:context7-lookup',
    async (event, libraryName: unknown, topic: unknown, maxTokens?: unknown) => {
      validateSender(event)
      checkRateLimit('tools:context7-lookup')
      assertSafeString(libraryName, 'libraryName', 256)
      assertSafeString(topic, 'topic', 512)
      auditLog('tools:context7-lookup', `${libraryName} — ${topic}`)

      try {
        const tokens = typeof maxTokens === 'number' ? maxTokens : undefined
        return await lookupDocs(libraryName as string, topic as string, { maxTokens: tokens })
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    }
  )
}
