import { ipcMain } from 'electron'
import keytar from 'keytar'

const SERVICE = 'forge'

const VALID_KEYS = new Set([
  'ANTHROPIC_BASE_KEY',
  'ANTHROPIC_OPUS_KEY',
  'GEMINI_API_KEY',
  'VERCEL_TOKEN',
  'GITHUB_TOKEN'
])

function assertValidKey(key: string): void {
  if (!VALID_KEYS.has(key)) {
    throw new Error(`Unknown setting key: ${key}`)
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', async (_event, key: string): Promise<string | null> => {
    assertValidKey(key)
    return keytar.getPassword(SERVICE, key)
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string): Promise<void> => {
    assertValidKey(key)
    await keytar.setPassword(SERVICE, key, value)
  })

  ipcMain.handle('settings:delete', async (_event, key: string): Promise<void> => {
    assertValidKey(key)
    await keytar.deletePassword(SERVICE, key)
  })
}
