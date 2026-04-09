import { defineConfig } from 'drizzle-kit'
import { join } from 'path'
import { homedir } from 'os'

const dbPath = join(homedir(), 'Library', 'Application Support', 'Forge', 'forge.db')

export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath
  }
})
