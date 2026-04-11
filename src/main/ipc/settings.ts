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

const MAX_VALUE_LENGTH = 512

function assertValidKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !VALID_KEYS.has(key)) {
    throw new Error(`Unknown setting key: ${String(key)}`)
  }
}

function assertValidValue(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_VALUE_LENGTH) {
    throw new Error('Invalid value: must be a non-empty string under 512 characters')
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', async (_event, key: string): Promise<string | null> => {
    assertValidKey(key)
    return keytar.getPassword(SERVICE, key)
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string): Promise<void> => {
    assertValidKey(key)
    assertValidValue(value)
    await keytar.setPassword(SERVICE, key, value)
  })

  ipcMain.handle('settings:delete', async (_event, key: string): Promise<void> => {
    assertValidKey(key)
    await keytar.deletePassword(SERVICE, key)
  })
}
