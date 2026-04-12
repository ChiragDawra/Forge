import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db/client'
import { projects } from '../db/schema'

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

function assertValidString(value: unknown, field: string, maxLen: number): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  if (value.length > maxLen) {
    throw new Error(`${field} exceeds max length of ${maxLen}`)
  }
}

export function registerProjectsIpc(): void {
  ipcMain.handle('projects:create', async (_event, name: string, prompt: string): Promise<ProjectRow> => {
    assertValidString(name, 'name', MAX_NAME_LENGTH)
    assertValidString(prompt, 'prompt', MAX_PROMPT_LENGTH)

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
    return toProjectRow(row)
  })

  ipcMain.handle('projects:list', async (): Promise<ProjectRow[]> => {
    const db = getDb()
    const rows = await db.select().from(projects).orderBy(desc(projects.createdAt))
    return rows.map(toProjectRow)
  })

  ipcMain.handle('projects:get', async (_event, id: string): Promise<ProjectRow | null> => {
    assertValidString(id, 'id', 64)
    const db = getDb()
    const [row] = await db.select().from(projects).where(eq(projects.id, id))
    return row ? toProjectRow(row) : null
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
