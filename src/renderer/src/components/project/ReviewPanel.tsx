// ReviewPanel — displays the code review report.
// Shows overall stats, a score bar, and per-file findings in a
// collapsible diff-like view.

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { ReviewReport } from '../../../../preload/index.d'

interface ReviewPanelProps {
  report: ReviewReport
}

export default function ReviewPanel({ report }: ReviewPanelProps): React.JSX.Element {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  function toggle(file: string): void {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  const scoreColor =
    report.averageScore >= 80 ? 'text-emerald-400' :
    report.averageScore >= 60 ? 'text-amber-400' :
    'text-red-400'

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="rounded-md border border-border bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Review complete — {report.filesReviewed} files
          </div>
          <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
            {report.averageScore}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">{report.overallSummary}</p>

        {/* Score bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              report.averageScore >= 80 ? 'bg-emerald-500' :
              report.averageScore >= 60 ? 'bg-amber-500' :
              'bg-red-500'
            }`}
            style={{ width: `${report.averageScore}%` }}
          />
        </div>

        {/* Counters */}
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle className="h-3 w-3" /> {report.errorCount} errors
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="h-3 w-3" /> {report.warningCount} warnings
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Info className="h-3 w-3" /> {report.infoCount} info
          </span>
          <span className="ml-auto text-muted-foreground">
            {report.model} · ${report.totalCostUsd.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Per-file findings */}
      <div className="space-y-1">
        {report.fileReviews.map((fr) => {
          const isOpen = expandedFiles.has(fr.file)
          const hasErrors = fr.findings.some((f) => f.severity === 'error')
          return (
            <div key={fr.file} className="rounded-md border border-border overflow-hidden">
              <button
                onClick={() => toggle(fr.file)}
                className="flex w-full items-center gap-2 bg-muted/10 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
              >
                {isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="flex-1 truncate font-mono text-xs">{fr.file}</span>
                <span className={`text-xs font-medium tabular-nums ${
                  fr.score >= 80 ? 'text-emerald-400' :
                  fr.score >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>{fr.score}</span>
                {hasErrors && <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="divide-y divide-border">
                  {fr.findings.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground italic">No findings</p>
                  ) : (
                    fr.findings.map((finding, i) => (
                      <div key={i} className="px-4 py-2.5 space-y-1">
                        <div className="flex items-start gap-2">
                          {finding.severity === 'error'   && <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />}
                          {finding.severity === 'warning' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
                          {finding.severity === 'info'    && <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`font-medium ${
                                finding.severity === 'error'   ? 'text-red-400' :
                                finding.severity === 'warning' ? 'text-amber-400' :
                                'text-blue-400'
                              }`}>{finding.message}</span>
                              {finding.line !== null && (
                                <span className="text-muted-foreground font-mono">L{finding.line}</span>
                              )}
                              <span className="ml-auto rounded px-1.5 py-0.5 bg-muted text-muted-foreground capitalize text-[10px]">
                                {finding.category}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{finding.suggestion}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="px-4 py-2 bg-muted/5">
                    <p className="text-xs text-muted-foreground italic">{fr.summary}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
