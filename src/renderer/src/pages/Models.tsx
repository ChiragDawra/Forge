import { useEffect, useState } from 'react'
import { BarChart3, Loader2, RefreshCw, Cpu } from 'lucide-react'
import { MODELS, MODEL_COSTS } from '@renderer/lib/constants'
import type { UsageSummaryRow } from '../../../preload/index.d'

const modelEntries = Object.entries(MODELS) as [string, string][]

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}

function formatTokens(n: number): string {
  if (n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function Models(): React.JSX.Element {
  const [summary, setSummary] = useState<UsageSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadSummary(isRefresh = false): Promise<void> {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await window.api?.ai?.usageSummary?.() ?? []
      setSummary(data)
    } catch {
      // Not in Electron or no data yet — leave empty
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  function getUsageForModel(modelId: string): UsageSummaryRow | undefined {
    return summary.find((r) => r.modelName === modelId)
  }

  const totalCost = summary.reduce((acc, r) => acc + r.totalCostUsd, 0)
  const totalTokens = summary.reduce((acc, r) => acc + r.totalInputTokens + r.totalOutputTokens, 0)
  const totalCalls = summary.reduce((acc, r) => acc + r.callCount, 0)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Models Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Token usage and cost tracking across all AI models.
          </p>
        </div>
        <button
          onClick={() => loadSummary(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Cost', value: formatCost(totalCost) },
          { label: 'Total Tokens', value: formatTokens(totalTokens) },
          { label: 'Total Calls', value: String(totalCalls) }
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-3 space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Per-model cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {modelEntries.map(([label, modelId]) => {
            const costs = MODEL_COSTS[modelId as keyof typeof MODEL_COSTS]
            const usage = getUsageForModel(modelId)
            return (
              <div
                key={modelId}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium leading-tight">
                    {label.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Input: ${costs.input.toFixed(2)} / 1M tokens</p>
                  <p>Output: ${costs.output.toFixed(2)} / 1M tokens</p>
                </div>

                <div className="border-t border-border pt-3 space-y-1.5">
                  <p className="text-lg font-bold">
                    {formatCost(usage?.totalCostUsd ?? 0)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Cpu className="h-3 w-3" />
                    {formatTokens((usage?.totalInputTokens ?? 0) + (usage?.totalOutputTokens ?? 0))} tokens
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {usage?.callCount ?? 0} calls
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
