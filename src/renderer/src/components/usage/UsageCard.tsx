import { BarChart3, Cpu, Clock } from 'lucide-react'
import { MODEL_COSTS, type ModelName } from '@renderer/lib/constants'
import { formatCost, formatTokens, formatRelativeTime } from '@renderer/lib/format'
import type { UsageSummaryRow } from '../../../../preload/index.d'

interface UsageCardProps {
  label: string
  modelId: ModelName
  usage: UsageSummaryRow | undefined
}

/**
 * Per-model usage card — totals for tokens, cost, calls and last used time.
 * Pricing comes from the shared MODEL_COSTS table so updates in one place.
 */
export default function UsageCard({ label, modelId, usage }: UsageCardProps): React.JSX.Element {
  const costs = MODEL_COSTS[modelId]
  const totalTokens = (usage?.totalInputTokens ?? 0) + (usage?.totalOutputTokens ?? 0)

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium leading-tight">{label}</span>
      </div>

      {costs && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Input: ${costs.input.toFixed(2)} / 1M tokens</p>
          <p>Output: ${costs.output.toFixed(2)} / 1M tokens</p>
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-1.5">
        <p className="text-lg font-bold">{formatCost(usage?.totalCostUsd ?? 0)}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Cpu className="h-3 w-3" />
          {formatTokens(totalTokens)} tokens
        </div>
        <p className="text-xs text-muted-foreground">{usage?.callCount ?? 0} calls</p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
          <Clock className="h-3 w-3" />
          Last used: {formatRelativeTime(usage?.lastUsedAt ?? null)}
        </div>
      </div>
    </div>
  )
}
