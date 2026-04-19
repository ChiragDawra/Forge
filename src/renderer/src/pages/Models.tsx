import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { MODELS, type ModelName } from '@renderer/lib/constants'
import { formatCost, formatTokens, modelLabel } from '@renderer/lib/format'
import UsageCard from '@renderer/components/usage/UsageCard'
import UsageChart from '@renderer/components/usage/UsageChart'
import type { UsageSummaryRow, DailyUsageRow } from '../../../preload/index.d'

const modelIds = Object.values(MODELS) as ModelName[]

export default function Models(): React.JSX.Element {
  const [summary, setSummary] = useState<UsageSummaryRow[]>([])
  const [daily, setDaily] = useState<DailyUsageRow[]>([])
  const [metric, setMetric] = useState<'cost' | 'tokens'>('cost')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false): Promise<void> {
    if (isRefresh) setRefreshing(true)
    try {
      const [s, d] = await Promise.all([
        window.api?.ai?.usageSummary?.() ?? Promise.resolve([]),
        window.api?.ai?.usageDaily?.(7) ?? Promise.resolve([])
      ])
      setSummary(s)
      setDaily(d)
    } catch (err) {
      // Non-fatal: browser mode or transient IPC error. Log so it's diagnosable.
      console.warn('[Models] Failed to load usage data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const getUsage = (modelId: ModelName): UsageSummaryRow | undefined =>
    summary.find((r) => r.modelName === modelId)

  const totals = useMemo(
    () => ({
      cost: summary.reduce((a, r) => a + r.totalCostUsd, 0),
      tokens: summary.reduce((a, r) => a + r.totalInputTokens + r.totalOutputTokens, 0),
      calls: summary.reduce((a, r) => a + r.callCount, 0)
    }),
    [summary]
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Models Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Token usage and cost tracking across all AI models.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Cost', value: formatCost(totals.cost) },
          { label: 'Total Tokens', value: formatTokens(totals.tokens) },
          { label: 'Total Calls', value: String(totals.calls) }
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card px-4 py-3 space-y-1"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-end gap-1 text-xs">
          {(['cost', 'tokens'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md border px-2 py-1 transition-colors ${
                metric === m
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'cost' ? 'Cost' : 'Tokens'}
            </button>
          ))}
        </div>
        <UsageChart rows={daily} days={7} metric={metric} />
      </div>

      {/* Per-model cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {modelIds.map((modelId) => (
            <UsageCard
              key={modelId}
              label={modelLabel(modelId)}
              modelId={modelId}
              usage={getUsage(modelId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
