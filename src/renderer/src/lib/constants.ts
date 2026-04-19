// Model identifiers
export const MODELS = {
  CLAUDE_OPUS: 'claude-opus-4-6',
  CLAUDE_BASE: 'claude-sonnet-4-5',
  GEMINI_FLASH: 'gemini-2.0-flash'
} as const

export type ModelName = (typeof MODELS)[keyof typeof MODELS]

// Cost per 1M tokens (USD)
export const MODEL_COSTS: Record<ModelName, { input: number; output: number }> = {
  [MODELS.CLAUDE_OPUS]: { input: 15.0, output: 75.0 },
  [MODELS.CLAUDE_BASE]: { input: 3.0, output: 15.0 },
  [MODELS.GEMINI_FLASH]: { input: 0.1, output: 0.4 }
}

// Short, human-friendly label for each model id
export const MODEL_LABELS: Record<ModelName, string> = {
  [MODELS.CLAUDE_OPUS]: 'Opus',
  [MODELS.CLAUDE_BASE]: 'Sonnet',
  [MODELS.GEMINI_FLASH]: 'Gemini'
}

// Tailwind classes + SVG fill per model (used by badges, cards, chart bars).
// Keeps colour source-of-truth next to the model list so renames touch one place.
export const MODEL_COLORS: Record<
  ModelName,
  { bg: string; text: string; border: string; fill: string }
> = {
  [MODELS.CLAUDE_OPUS]: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    fill: '#a855f7'
  },
  [MODELS.CLAUDE_BASE]: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-500/30',
    fill: '#3b82f6'
  },
  [MODELS.GEMINI_FLASH]: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    fill: '#f59e0b'
  }
}

// Phase definitions (0-indexed)
export const PHASES = [
  { id: 0, name: 'Intake', slug: '0-intake' },
  { id: 1, name: 'Planning', slug: '1-planning' },
  { id: 2, name: 'Design', slug: '2-design' },
  { id: 3, name: 'Scaffold', slug: '3-scaffold' },
  { id: 4, name: 'Code Generation', slug: '4-codegen' },
  { id: 5, name: 'Code Review', slug: '5-review' },
  { id: 6, name: 'Security Audit', slug: '6-security' },
  { id: 7, name: 'Testing', slug: '7-testing' },
  { id: 8, name: 'Deploy', slug: '8-deploy' }
] as const

export type PhaseSlug = (typeof PHASES)[number]['slug']

// Project statuses
export const PROJECT_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETE: 'complete',
  FAILED: 'failed'
} as const

// Keytar service name
export const KEYTAR_SERVICE = 'forge'

// API key names (stored in keytar)
export const API_KEYS = {
  ANTHROPIC_BASE: 'ANTHROPIC_BASE_KEY',
  ANTHROPIC_OPUS: 'ANTHROPIC_OPUS_KEY',
  GEMINI: 'GEMINI_API_KEY',
  VERCEL: 'VERCEL_TOKEN',
  GITHUB: 'GITHUB_TOKEN'
} as const
