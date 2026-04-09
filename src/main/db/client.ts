import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import * as schema from './schema'

type ForgeDb = BetterSQLite3Database<typeof schema>

let _sqlite: Database.Database | null = null
let _db: ForgeDb | null = null

export function initDb(userDataPath: string): ForgeDb {
  mkdirSync(userDataPath, { recursive: true })
  const dbPath = join(userDataPath, 'forge.db')

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  const migrationsPath = join(__dirname, 'migrations')
  if (existsSync(migrationsPath)) {
    migrate(db, { migrationsFolder: migrationsPath })
  } else {
    console.log('[DB] No migrations folder — skipping (run `drizzle-kit generate` to create)')
  }

  _sqlite = sqlite
  _db = db
  console.log('[DB] Initialized at', dbPath)
  return db
}

export function getDb(): ForgeDb {
  if (!_db) throw new Error('DB not initialized — call initDb() first')
  return _db
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}
