import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync } from 'fs'
import * as schema from './schema'

const DB_DIR = join(homedir(), 'Library', 'Application Support', 'Forge')
const DB_PATH = join(DB_DIR, 'forge.db')

let _db: ReturnType<typeof drizzle> | null = null

export function initDb(): void {
  mkdirSync(DB_DIR, { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  _db = drizzle(sqlite, { schema })

  const migrationsPath = join(__dirname, 'migrations')
  try {
    migrate(_db, { migrationsFolder: migrationsPath })
  } catch {
    // Migrations folder may not exist on first run before drizzle-kit generate
    console.log('[DB] No migrations found — running without migration (dev mode)')
  }

  console.log('[DB] Initialized at', DB_PATH)
}

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) throw new Error('DB not initialized — call initDb() first')
  return _db
}
