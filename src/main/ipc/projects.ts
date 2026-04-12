import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db/client'
import { projects } from '../db/schema'
import { validateSender, checkRateLimit, assertSafeString, auditLog, safeErrorMessage } from './security'

export interface ProjectRow {
  id: string
  name: string
  prompt: string
  status: string
  techStack: string | null
  createdAt: number
  updatedAt: number
}

const MAX_NAME_LENGTH = 200
const MAX_PROMPT_LENGTH = 10_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertValidUUID(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error('Invalid project ID format')
  }
}

export function registerProjectsIpc(): void {
  ipcMain.handle('projects:create', async (event, name: string, prompt: string): Promise<ProjectRow> => {
    try {
      validateSender(event)
      checkRateLimit('projects:create')
      assertSafeString(name, 'name', MAX_NAME_LENGTH)
      assertSafeString(prompt, 'prompt', MAX_PROMPT_LENGTH)

      const db = getDb()
      const now = new Date()
      const id = randomUUID()

      await db.insert(projects).values({
        id,
        name: name.trim(),
        prompt: prompt.trim(),
        status: 'pending',
        createdAt: now,
        updatedAt: now
      })

      const [row] = await db.select().from(projects).where(eq(projects.id, id))
      auditLog('projects:create', id)
      return toProjectRow(row)
    } catch (err) {
      auditLog('projects:create:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  ipcMain.handle('projects:list', async (event): Promise<ProjectRow[]> => {
    try {
      validateSender(event)
      checkRateLimit('projects:list')
      const db = getDb()
      const rows = await db.select().from(projects).orderBy(desc(projects.createdAt))
      auditLog('projects:list', `${rows.length} projects`)
      return rows.map(toProjectRow)
    } catch (err) {
      auditLog('projects:list:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  ipcMain.handle('projects:get', async (event, id: string): Promise<ProjectRow | null> => {
    try {
      validateSender(event)
      checkRateLimit('projects:get')
      assertValidUUID(id)

      const db = getDb()
      const [row] = await db.select().from(projects).where(eq(projects.id, id))
      auditLog('projects:get', id)
      return row ? toProjectRow(row) : null
    } catch (err) {
      auditLog('projects:get:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })
}

function toProjectRow(row: typeof projects.$inferSelect): ProjectRow {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    status: row.status,
    techStack: row.techStack,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Number(row.updatedAt)
  }
}
