/**
 * Context7 — library docs lookup via the Context7 MCP API.
 *
 * Resolves a library name to its Context7-compatible ID, then fetches
 * relevant documentation for a given topic. Useful for feeding accurate,
 * up-to-date library docs into AI prompts.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface LibraryMatch {
  id: string
  name: string
  description: string
}

export interface DocsResult {
  libraryId: string
  topic: string
  content: string
  tokenCount: number
}

// ─── Constants ──────────────────────────────────────────────────

const C7_BASE = 'https://context7.com/api'
const REQUEST_TIMEOUT = 15_000

// ─── Helpers ────────────────────────────────────────────────────

async function c7Fetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const res = await fetch(`${C7_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Context7 ${path} failed (${res.status}): ${text}`)
    }

    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Resolve a library name (e.g. "react", "drizzle-orm") to Context7 library IDs.
 * Returns the top matches sorted by relevance.
 */
export async function resolveLibrary(libraryName: string): Promise<LibraryMatch[]> {
  if (!libraryName || libraryName.trim().length === 0) {
    throw new Error('Library name must be a non-empty string')
  }

  const result = await c7Fetch<{ libraries: LibraryMatch[] }>('/v1/resolve', {
    libraryName: libraryName.trim()
  })

  return result.libraries ?? []
}

/**
 * Fetch documentation for a resolved library ID on a specific topic.
 * Returns markdown content suitable for injecting into an AI prompt.
 */
export async function getLibraryDocs(
  libraryId: string,
  topic: string,
  opts: { maxTokens?: number } = {}
): Promise<DocsResult> {
  if (!libraryId || !topic) {
    throw new Error('libraryId and topic are required')
  }

  const result = await c7Fetch<{ content: string; tokenCount: number }>('/v1/docs', {
    libraryId,
    topic: topic.trim(),
    maxTokens: opts.maxTokens ?? 5000
  })

  return {
    libraryId,
    topic,
    content: result.content ?? '',
    tokenCount: result.tokenCount ?? 0
  }
}

/**
 * Convenience: resolve + fetch in one call. Uses the first matching library.
 * Throws if no match is found.
 */
export async function lookupDocs(
  libraryName: string,
  topic: string,
  opts: { maxTokens?: number } = {}
): Promise<DocsResult> {
  const matches = await resolveLibrary(libraryName)
  if (matches.length === 0) {
    throw new Error(`No Context7 library found for "${libraryName}"`)
  }

  return getLibraryDocs(matches[0].id, topic, opts)
}
