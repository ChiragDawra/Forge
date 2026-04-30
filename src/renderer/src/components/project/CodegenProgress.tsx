// CodegenProgress — shows live progress during the codegen phase.
// Displays a file-written counter, batch progress bar, and the last
// log message. Used inside Project.tsx Phase 4 section.

import { CheckCircle2, Code2, Loader2 } from 'lucide-react'
import type { CodegenResult } from '../../../../preload/index.d'

interface CodegenProgressProps {
  filesWritten: number
  filesPlanned: number
  currentFile?: string
  busy: boolean
  result: CodegenResult | null
}

export default function CodegenProgress({
  filesWritten,
  filesPlanned,
  currentFile,
  busy,
  result
}: CodegenProgressProps): React.JSX.Element {
  if (result) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Codegen complete
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="space-y-0.5">
            <p className="text-foreground font-medium text-lg">{result.filesWritten}</p>
            <p>files written</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-foreground font-medium text-lg">{result.filesSkipped}</p>
            <p>skipped</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-foreground font-medium text-lg">{result.batchesCompleted}</p>
            <p>batches</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {result.model} · ${result.totalCostUsd.toFixed(4)}
        </p>
      </div>
    )
  }

  if (!busy && filesWritten === 0) return <></>

  const pct = filesPlanned > 0 ? Math.round((filesWritten / filesPlanned) * 100) : 0

  return (
    <div className="rounded-md border border-border bg-muted/10 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
          : <Code2 className="h-4 w-4 text-primary" />}
        Generating code…
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{filesWritten} / {filesPlanned > 0 ? filesPlanned : '?'} files</span>
          {filesPlanned > 0 && <span>{pct}%</span>}
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${filesPlanned > 0 ? pct : 0}%` }}
          />
        </div>
      </div>

      {currentFile && (
        <p className="truncate font-mono text-xs text-muted-foreground">
          ↳ {currentFile}
        </p>
      )}
    </div>
  )
}
