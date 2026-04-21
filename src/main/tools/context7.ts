// Thin wrapper over Context7's public HTTP docs API.
// Given a library identifier, returns up-to-date documentation text that
// can be pasted into an LLM prompt for grounding.

export interface Context7Query {
  /** Library identifier, e.g. "react", "vercel/next.js", "@anthropic-ai/sdk" */
  library: string
  /** Optional topic/keyword to narrow the returned docs. */
  topic?: string
  /** Max tokens of documentation to request (Context7 budgets on this). */
  tokens?: number
}

export interface Context7Response {
  library: string
  topic: string | null
  content: string
  source: string
  fetchedAt: number
}

const DEFAULT_BASE_URL = 'https://context7.com/api/v1'
const DEFAULT_TOKENS = 4000
const REQUEST_TIMEOUT_MS = 15_000

// Context7 library ids use slash-separated org/name. Allow a conservative
// charset — anything else risks sending junk up a URL.
const LIBRARY_ID_RE = /^[a-zA-Z0-9._\-@/]+$/

function baseUrl(): string {
  return process.env.CONTEXT7_BASE_URL?.trim() || DEFAULT_BASE_URL
}

/**
 * Fetch current docs for a library from Context7.
 * Throws on network/HTTP failure; the caller decides how to surface that.
 */
export async function fetchContext7Docs(q: Context7Query): Promise<Context7Response> {
  const { library } = q
  if (!library || typeof library !== 'string') {
    throw new Error('fetchContext7Docs: library is required')
  }
  if (!LIBRARY_ID_RE.test(library)) {
    throw new Error(`fetchContext7Docs: invalid library id "${library}"`)
  }

  const tokens = clampTokens(q.tokens)
  const topic = q.topic?.trim() || null

  // Per-segment encoding — safer than encodeURI on a full path; defence
  // in depth alongside LIBRARY_ID_RE.
  const encodedLib = library.split('/').map(encodeURIComponent).join('/')
  const url = new URL(`${baseUrl()}/${encodedLib}`)
  url.searchParams.set('type', 'txt')
  url.searchParams.set('tokens', String(tokens))
  if (topic) url.searchParams.set('topic', topic)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'forge/0.1 (context7 tool)'
      },
      signal: ctrl.signal
    })

    if (!res.ok) {
      throw new Error(`Context7 ${res.status} ${res.statusText}`)
    }

    // Cap response body to prevent a hostile upstream from blocking the
    // main process with an unbounded text stream. ~10 chars per token is
    // generous headroom above the requested budget.
    const maxBytes = tokens * 10
    const contentLength = Number(res.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`Context7 response too large (${contentLength} > ${maxBytes})`)
    }
    const content = await readCapped(res, maxBytes)
    return {
      library,
      topic,
      content,
      source: url.toString(),
      fetchedAt: Date.now()
    }
  } finally {
    clearTimeout(timer)
  }
}

function clampTokens(n: number | undefined): number {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_TOKENS
  return Math.min(Math.max(Math.floor(v), 500), 20_000)
}

/**
 * Read a Response body with a hard byte cap. Aborts and throws if the
 * incoming stream exceeds the cap before EOF.
 */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return (await res.text()).slice(0, maxBytes)

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      reader.cancel().catch(() => undefined)
      throw new Error(`Context7 response exceeded ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks))
}
