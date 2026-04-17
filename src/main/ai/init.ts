import keytar from 'keytar'
import { initClaudeBase } from './claude-base'
import { initClaudeOpus } from './claude-opus'
import { initGemini } from './gemini'

const SERVICE = 'forge'

/**
 * Loads API keys from the OS keychain and initialises all AI clients.
 * Called once at app startup after the DB is ready.
 * Keys that aren't set yet are skipped — clients will throw a clear
 * "not initialised" error at call time, which the UI surfaces to the user.
 */
export async function initAiClients(): Promise<void> {
  const [baseKey, opusKey, geminiKey] = await Promise.all([
    keytar.getPassword(SERVICE, 'ANTHROPIC_BASE_KEY').catch(() => null),
    keytar.getPassword(SERVICE, 'ANTHROPIC_OPUS_KEY').catch(() => null),
    keytar.getPassword(SERVICE, 'GEMINI_API_KEY').catch(() => null)
  ])

  if (baseKey) {
    initClaudeBase(baseKey)
    console.log('[AI] Claude Base initialised')
  }
  if (opusKey) {
    initClaudeOpus(opusKey)
    console.log('[AI] Claude Opus initialised')
  }
  if (geminiKey) {
    initGemini(geminiKey)
    console.log('[AI] Gemini initialised')
  }
}

/**
 * Re-initialises clients after the user saves new keys in Settings.
 * Called from the settings IPC handler after a successful keytar write.
 */
export async function reinitAiClients(): Promise<void> {
  await initAiClients()
}
