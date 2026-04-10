import { BarChart3 } from 'lucide-react'
import { MODELS, MODEL_COSTS } from '@renderer/lib/constants'

const modelEntries = Object.entries(MODELS) as [string, string][]

export default function Models(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Models Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Token usage and cost tracking across all AI models.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {modelEntries.map(([label, modelId]) => {
          const costs = MODEL_COSTS[modelId as keyof typeof MODEL_COSTS]
          return (
            <div
              key={modelId}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{label.replace(/_/g, ' ')}</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Input: ${costs.input.toFixed(2)} / 1M tokens</p>
                <p>Output: ${costs.output.toFixed(2)} / 1M tokens</p>
              </div>
              <p className="text-lg font-bold">$0.00</p>
              <p className="text-xs text-muted-foreground">0 total tokens</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
