// SecurityAudit — displays the security audit report.
// Shows risk score, npm vulnerability counts, and per-file static findings.

import { useState } from 'react'
import { ShieldAlert, ShieldCheck, ShieldX, ChevronDown, ChevronRight, Package } from 'lucide-react'
import type { SecurityReport } from '../../../../preload/index.d'

interface SecurityAuditProps {
  report: SecurityReport
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-orange-400',
  medium:   'text-amber-400',
  low:      'text-blue-400',
  info:     'text-muted-foreground'
}

const SEVERITY_BG: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30',
  high:     'bg-orange-500/10 border-orange-500/30',
  medium:   'bg-amber-500/10 border-amber-500/30',
  low:      'bg-blue-500/10 border-blue-500/30',
  info:     'bg-muted/20 border-border'
}

export default function SecurityAudit({ report }: SecurityAuditProps): React.JSX.Element {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  function toggle(file: string): void {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      next.has(file) ? next.delete(file) : next.add(file)
      return next
    })
  }

  const riskColor =
    report.overallRiskScore >= 70 ? 'text-red-400' :
    report.overallRiskScore >= 40 ? 'text-amber-400' :
    'text-emerald-400'

  const RiskIcon = report.criticalCount > 0 ? ShieldX :
    report.highCount > 0 ? ShieldAlert : ShieldCheck

  const iconColor = report.criticalCount > 0 ? 'text-red-400' :
    report.highCount > 0 ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-md border border-border bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RiskIcon className={`h-4 w-4 ${iconColor}`} />
            Security audit — {report.filesScanned} files scanned
          </div>
          <span className={`text-2xl font-bold tabular-nums ${riskColor}`}>
            {report.overallRiskScore}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">{report.executiveSummary}</p>

        {/* Risk bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              report.overallRiskScore >= 70 ? 'bg-red-500' :
              report.overallRiskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${report.overallRiskScore}%` }}
          />
        </div>

        {/* Severity counts */}
        <div className="flex flex-wrap gap-3 text-xs">
          {report.criticalCount > 0 && (
            <span className="text-red-500 font-medium">{report.criticalCount} critical</span>
          )}
          {report.highCount > 0 && (
            <span className="text-orange-400">{report.highCount} high</span>
          )}
          {report.mediumCount > 0 && (
            <span className="text-amber-400">{report.mediumCount} medium</span>
          )}
          {report.lowCount > 0 && (
            <span className="text-blue-400">{report.lowCount} low</span>
          )}
          <span className="ml-auto text-muted-foreground">
            {report.model} · ${report.totalCostUsd.toFixed(4)}
          </span>
        </div>
      </div>

      {/* npm audit section */}
      {report.npmAudit.ran && report.npmAudit.totalVulnerabilities > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <Package className="h-4 w-4" />
            npm audit: {report.npmAudit.totalVulnerabilities} dependency vulnerabilities
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {report.npmAudit.critical > 0 && <span className="text-red-400">{report.npmAudit.critical} critical</span>}
            {report.npmAudit.high > 0 && <span className="text-orange-400">{report.npmAudit.high} high</span>}
            {report.npmAudit.moderate > 0 && <span className="text-amber-400">{report.npmAudit.moderate} moderate</span>}
            {report.npmAudit.low > 0 && <span>{report.npmAudit.low} low</span>}
          </div>
          <p className="text-xs text-muted-foreground">Run <code className="font-mono">npm audit fix</code> in the project root to resolve</p>
        </div>
      )}

      {/* Per-file findings */}
      <div className="space-y-1">
        {report.fileResults
          .filter((fr) => fr.findings.length > 0)
          .map((fr) => {
            const isOpen = expandedFiles.has(fr.file)
            const hasSerious = fr.findings.some((f) => f.severity === 'critical' || f.severity === 'high')
            return (
              <div key={fr.file} className={`rounded-md border overflow-hidden ${hasSerious ? 'border-red-500/30' : 'border-border'}`}>
                <button
                  onClick={() => toggle(fr.file)}
                  className="flex w-full items-center gap-2 bg-muted/10 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="flex-1 truncate font-mono text-xs">{fr.file}</span>
                  <span className={`text-xs font-medium tabular-nums ${
                    fr.riskScore >= 70 ? 'text-red-400' :
                    fr.riskScore >= 40 ? 'text-amber-400' : 'text-muted-foreground'
                  }`}>{fr.riskScore}</span>
                  <span className="text-xs text-muted-foreground">{fr.findings.length} issues</span>
                </button>

                {isOpen && (
                  <div className="divide-y divide-border">
                    {fr.findings.map((finding, i) => (
                      <div key={i} className={`mx-3 my-2 rounded p-2.5 border ${SEVERITY_BG[finding.severity] ?? SEVERITY_BG.info}`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-semibold ${SEVERITY_COLOR[finding.severity] ?? ''}`}>
                            {finding.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {finding.line !== null && (
                              <span className="font-mono text-[10px] text-muted-foreground">L{finding.line}</span>
                            )}
                            <span className="rounded px-1.5 py-0.5 bg-muted text-[10px] text-muted-foreground capitalize">
                              {finding.category}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{finding.description}</p>
                        <p className="mt-1 text-xs text-foreground/70">
                          <span className="font-medium">Fix: </span>{finding.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
