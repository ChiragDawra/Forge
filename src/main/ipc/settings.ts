import { ipcMain } from 'electron'
import keytar from 'keytar'
import { validateSender, checkRateLimit, assertSafeString, auditLog, safeErrorMessage } from './security'
import { reinitAiClients } from '../ai/init'

const SERVICE = 'forge'
const MAX_VALUE_LENGTH = 512

const VALID_KEYS = new Set([
  'ANTHROPIC_BASE_KEY',
  'ANTHROPIC_OPUS_KEY',
  'GEMINI_API_KEY',
  'VERCEL_TOKEN',
  'GITHUB_TOKEN'
])

function assertValidKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !VALID_KEYS.has(key)) {
    throw new Error(`Unknown setting key`)
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', async (event, key: string): Promise<string | null> => {
    try {
      validateSender(event)
      checkRateLimit('settings:get')
      assertValidKey(key)
      auditLog('settings:get', key)
      return await keytar.getPassword(SERVICE, key)
    } catch (err) {
      auditLog('settings:get:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  ipcMain.handle('settings:set', async (event, key: string, value: string): Promise<void> => {
    try {
      validateSender(event)
      checkRateLimit('settings:set')
      assertValidKey(key)
      assertSafeString(value, 'value', MAX_VALUE_LENGTH)
      await keytar.setPassword(SERVICE, key, value)
      auditLog('settings:set', key)
      // Reinit AI clients so new key takes effect immediately (non-blocking)
      reinitAiClients().catch(() => {/* silent — will retry on next call */})
    } catch (err) {
      auditLog('settings:set:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })

  ipcMain.handle('settings:delete', async (event, key: string): Promise<void> => {
    try {
      validateSender(event)
      checkRateLimit('settings:delete')
      assertValidKey(key)
      await keytar.deletePassword(SERVICE, key)
      auditLog('settings:delete', key)
    } catch (err) {
      auditLog('settings:delete:error', safeErrorMessage(err))
      throw new Error(safeErrorMessage(err))
    }
  })
}
