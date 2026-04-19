import { useMemo } from 'react'
import { formatCost, modelColor, modelLabel } from '@renderer/lib/format'
import type { DailyUsageRow } from '../../../../preload/index.d'

interface UsageChartProps {
  rows: DailyUsageRow[]
  days?: number
  metric?: 'cost' | 'tokens'
}

interface Bucket {
  date: string // YYYY-MM-DD
  shortLabel: string // e.g. "Mon 14"
  byModel: Record<string, number>
  total: number
}

/**
 * Stacked bar chart — daily usage per model for the last N days.
 * Implemented as inline SVG to avoid pulling in Chart.js / d3.
 */
export default function UsageChart({
  rows,
  days = 7,
  metric = 'cost'
}: UsageChartProps): React.JSX.Element {
  const { buckets, models, maxTotal } = useMemo(() => {
    // Build a fixed window of the last N days so empty days still show.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const window: Bucket[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const shortLabel = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
      window.push({ date: iso, shortLabel, byModel: {}, total: 0 })
    }

    const byDate = new Map(window.map((b) => [b.date, b]))
    const modelSet = new Set<string>()

    for (const r of rows) {
      modelSet.add(r.modelName)
      const b = byDate.get(r.date)
      if (!b) continue
      const v = metric === 'cost' ? r.totalCostUsd : r.totalTokens
      b.byModel[r.modelName] = (b.byModel[r.modelName] ?? 0) + v
      b.total += v
    }

    return {
      buckets: window,
      models: Array.from(modelSet).sort(),
      maxTotal: Math.max(1, ...window.map((b) => b.total))
    }
  }, [rows, days, metric])

  // Chart geometry
  const W = 560
  const H = 180
  const padL = 40
  const padR = 12
  const padT = 12
  const padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const barSlot = plotW / buckets.length
  const barW = Math.max(6, barSlot * 0.6)

  const yLabel = (v: number): string =>
    metric === 'cost' ? formatCost(v) : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v)

  const isEmpty = rows.length === 0

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Last {days} days</h3>
          <p className="text-xs text-muted-foreground">
            Daily {metric === 'cost' ? 'cost' : 'tokens'} by model
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {models.length === 0 ? (
            <span className="text-xs text-muted-foreground">No usage yet</span>
          ) : (
            models.map((m) => (
              <div key={m} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: modelColor(m).fill }}
                />
                {modelLabel(m)}
              </div>
            ))
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Usage chart">
        {/* Y-axis gridlines (4 lines incl. zero) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + plotH * (1 - t)
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize="9"
              >
                {yLabel(maxTotal * t)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {buckets.map((b, i) => {
          const x = padL + i * barSlot + (barSlot - barW) / 2
          let yCursor = padT + plotH
          return (
            <g key={b.date}>
              {models.map((m) => {
                const v = b.byModel[m] ?? 0
                if (v === 0) return null
                const h = (v / maxTotal) * plotH
                yCursor -= h
                return (
                  <rect
                    key={m}
                    x={x}
                    y={yCursor}
                    width={barW}
                    height={h}
                    fill={modelColor(m).fill}
                    opacity={0.85}
                  >
                    <title>
                      {b.shortLabel} · {modelLabel(m)} · {yLabel(v)}
                    </title>
                  </rect>
                )
              })}
              <text
                x={x + barW / 2}
                y={H - padB + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="9"
              >
                {b.shortLabel}
              </text>
            </g>
          )
        })}

        {isEmpty && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="11"
          >
            No activity yet — run an AI call to populate this chart.
          </text>
        )}
      </svg>
    </div>
  )
}
