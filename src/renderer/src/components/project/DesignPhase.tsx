import { useState } from 'react'
import { Copy, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import type { DesignResult, DesignComponent } from '../../../../preload/index.d'

interface DesignPhaseProps {
  result: DesignResult
}

const PRIORITY_COLOR: Record<DesignComponent['priority'], string> = {
  high:   'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low:    'bg-muted text-muted-foreground'
}

export default function DesignPhase({ result }: DesignPhaseProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [showComponents, setShowComponents] = useState(true)

  async function copyBrief(): Promise<void> {
    await navigator.clipboard.writeText(result.brief)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const high   = result.components.filter((c) => c.priority === 'high')
  const medium = result.components.filter((c) => c.priority === 'medium')
  const low    = result.components.filter((c) => c.priority === 'low')

  return (
    <div className="space-y-4">
      {/* Design brief */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5">
          <span className="text-sm font-semibold">Design Brief</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {result.model} · ${result.costUsd.toFixed(4)}
            </span>
            <button
              onClick={copyBrief}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">
            Paste this into <strong>v0</strong>, <strong>Stitch</strong>, or <strong>Lovable</strong> to generate your UI.
          </p>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-black/30 rounded p-3 max-h-64 overflow-y-auto">
            {result.brief}
          </pre>
        </div>
      </div>

      {/* Component map */}
      <div className="rounded-md border border-border overflow-hidden">
        <button
          onClick={() => setShowComponents((s) => !s)}
          className="flex w-full items-center gap-2 border-b border-border bg-muted/20 px-4 py-2.5 text-left"
        >
          {showComponents
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-sm font-semibold">Component Map</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {result.components.length} components
          </span>
        </button>

        {showComponents && (
          <div className="divide-y divide-border">
            {[
              { label: 'High priority', items: high },
              { label: 'Medium priority', items: medium },
              { label: 'Low priority', items: low }
            ]
              .filter((g) => g.items.length > 0)
              .map((group) => (
                <div key={group.label}>
                  <p className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground bg-muted/10">
                    {group.label}
                  </p>
                  {group.items.map((c) => (
                    <div key={c.path} className="flex items-start gap-3 px-4 py-2 text-sm">
                      <span className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${PRIORITY_COLOR[c.priority]}`}>
                        {c.priority}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{c.path}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Loading placeholder used by Project page while phase is in flight
export function DesignPhaseSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Generating design brief and component map…
    </div>
  )
}
