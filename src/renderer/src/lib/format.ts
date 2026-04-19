import { MODEL_LABELS, MODEL_COLORS, type ModelName } from './constants'

export function formatCost(usd: number): string {
  if (!Number.isFinite(usd) || usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatRelativeTime(ms: number | null): string {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ms).toLocaleDateString()
}

const FALLBACK_COLOR = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
  border: 'border-border',
  fill: '#6b7280'
}

export function modelLabel(modelId: string): string {
  return MODEL_LABELS[modelId as ModelName] ?? modelId
}

export function modelColor(modelId: string): (typeof MODEL_COLORS)[ModelName] {
  return MODEL_COLORS[modelId as ModelName] ?? FALLBACK_COLOR
}
