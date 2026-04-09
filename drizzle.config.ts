import { defineConfig } from 'drizzle-kit'

// drizzle-kit only needs a real DB url for `push`/`studio`. For `generate`
// the schema file is enough. Default to a local dev path so this config
// works on macOS, Linux, and Windows. Override with FORGE_DB_URL when
// running drizzle-kit against the real Electron userData database.
const dbUrl = process.env.FORGE_DB_URL ?? './.local/forge-dev.db'

export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl
  }
})
