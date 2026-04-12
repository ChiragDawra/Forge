import { type IpcMainInvokeEvent } from 'electron'

// ─── Rate limiter ────────────────────────────────────────────
const callLog = new Map<string, number[]>()
const MAX_CALLS_PER_SECOND = 20
const CLEANUP_INTERVAL_MS = 30_000

// Clean stale entries periodically
setInterval(() => {
  const cutoff = Date.now() - 2000
  for (const [key, timestamps] of callLog) {
    const fresh = timestamps.filter((t) => t > cutoff)
    if (fresh.length === 0) callLog.delete(key)
    else callLog.set(key, fresh)
  }
}, CLEANUP_INTERVAL_MS)

export function checkRateLimit(channel: string): void {
  const now = Date.now()
  const timestamps = callLog.get(channel) ?? []
  const recent = timestamps.filter((t) => now - t < 1000)

  if (recent.length >= MAX_CALLS_PER_SECOND) {
    throw new Error('Rate limit exceeded — try again in a moment')
  }

  recent.push(now)
  callLog.set(channel, recent)
}

// ─── Sender validation ──────────────────────────────────────
export function validateSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame
  if (!frame) {
    throw new Error('IPC call from unknown sender')
  }
  const url = frame.url
  // Allow file:// (production) and localhost dev server
  if (!url.startsWith('file://') && !url.startsWith('http://localhost:')) {
    throw new Error('IPC call from unauthorized origin')
  }
}

// ─── Input sanitization ─────────────────────────────────────
const CONTROL_CHAR_RE = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/

export function assertSafeString(
  value: unknown,
  field: string,
  maxLen: number
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  if (value.length > maxLen) {
    throw new Error(`${field} exceeds maximum length`)
  }
  if (CONTROL_CHAR_RE.test(value)) {
    throw new Error(`${field} contains invalid characters`)
  }
}

// ─── Audit logger ───────────────────────────────────────────
export function auditLog(action: string, detail?: string): void {
  const ts = new Date().toISOString()
  const msg = detail ? `[AUDIT] ${ts} ${action}: ${detail}` : `[AUDIT] ${ts} ${action}`
  console.log(msg)
}

// ─── Safe error message ─────────────────────────────────────
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Only return messages we explicitly threw (validation, rate limit)
    if (
      err.message.startsWith('Rate limit') ||
      err.message.includes('must be') ||
      err.message.includes('exceeds') ||
      err.message.includes('invalid') ||
      err.message.includes('Unknown setting') ||
      err.message.includes('unauthorized')
    ) {
      return err.message
    }
  }
  return 'An unexpected error occurred'
}
