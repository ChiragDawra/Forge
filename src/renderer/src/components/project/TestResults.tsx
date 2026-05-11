// TestResults — displays the Playwright testing report.
// Shows pass/fail counts, a progress bar, test output, and the
// generated test file path.

import { CheckCircle2, XCircle, AlertTriangle, Terminal, FlaskConical } from 'lucide-react'
import type { TestingReport } from '../../../../preload/index.d'

interface TestResultsProps {
  report: TestingReport
}

export default function TestResults({ report }: TestResultsProps): React.JSX.Element {
  const allPassed = report.failed === 0 && report.playwrightRan && report.totalTests > 0
  const hasFailed = report.failed > 0

  const StatusIcon = allPassed ? CheckCircle2 : hasFailed ? XCircle : AlertTriangle
  const iconColor  = allPassed ? 'text-emerald-400' : hasFailed ? 'text-red-400' : 'text-amber-400'

  const passedPct = report.totalTests > 0
    ? Math.round((report.passed / report.totalTests) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-md border border-border bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StatusIcon className={`h-4 w-4 ${iconColor}`} />
            {report.playwrightRan
              ? `${report.testsGenerated} tests generated · ${report.totalTests} ran`
              : `${report.testsGenerated} tests generated`}
          </div>
          {report.playwrightRan && (
            <span className={`text-2xl font-bold tabular-nums ${iconColor}`}>
              {passedPct}%
            </span>
          )}
        </div>

        {/* Pass bar */}
        {report.playwrightRan && report.totalTests > 0 && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allPassed ? 'bg-emerald-500' : hasFailed ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${passedPct}%` }}
            />
          </div>
        )}

        {/* Counts */}
        <div className="flex gap-4 text-xs">
          {report.playwrightRan ? (
            <>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> {report.passed} passed
              </span>
              {report.failed > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="h-3 w-3" /> {report.failed} failed
                </span>
              )}
              {report.skipped > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> {report.skipped} skipped
                </span>
              )}
              <span className="text-muted-foreground">
                {(report.durationMs / 1000).toFixed(1)}s
              </span>
            </>
          ) : (
            <span className="text-amber-400 flex items-center gap-1">
              <FlaskConical className="h-3 w-3" />
              Playwright not available — tests written to disk
            </span>
          )}
          <span className="ml-auto text-muted-foreground">
            {report.model} · ${report.totalCostUsd.toFixed(4)}
          </span>
        </div>

        {/* Test file path */}
        {report.testFilePath && (
          <div className="flex items-center gap-2 rounded bg-muted/30 px-2.5 py-1.5 text-xs font-mono text-muted-foreground">
            <FlaskConical className="h-3 w-3 shrink-0" />
            <span className="truncate">{report.testFilePath}</span>
          </div>
        )}
      </div>

      {/* Terminal output */}
      {report.output && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Playwright output</span>
          </div>
          <pre className="max-h-48 overflow-y-auto p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
            {report.output}
          </pre>
        </div>
      )}

      {/* Manual run hint when playwright didn't run */}
      {!report.playwrightRan && report.testsGenerated > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300 space-y-1">
          <p className="font-medium">Run tests manually:</p>
          <code className="font-mono text-[11px] block">
            cd {report.testFilePath.replace('/tests/e2e/app.spec.ts', '')} && npx playwright test
          </code>
        </div>
      )}
    </div>
  )
}
