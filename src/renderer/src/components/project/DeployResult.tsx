// DeployResult — displays the Vercel deploy report.
// Shows deployment status, the live URL with a copy button,
// environment badge, duration, and CLI output.

import { useState } from 'react'
import { CheckCircle2, XCircle, ExternalLink, Copy, Check, Rocket, Terminal } from 'lucide-react'
import type { DeployReport } from '../../../../preload/index.d'

interface DeployResultProps {
  report: DeployReport
}

export default function DeployResult({ report }: DeployResultProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  async function copyUrl(): Promise<void> {
    if (!report.url) return
    await navigator.clipboard.writeText(report.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className={`rounded-md border p-4 space-y-3 ${
        report.success
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-red-500/30 bg-red-500/5'
      }`}>
        <div className="flex items-center gap-2 text-sm font-medium">
          {report.success
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            : <XCircle className="h-4 w-4 text-red-400" />}
          <span className={report.success ? 'text-emerald-300' : 'text-red-300'}>
            {report.success ? 'Deployed successfully' : 'Deploy failed'}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {(report.durationMs / 1000).toFixed(1)}s
          </span>
        </div>

        {/* Live URL */}
        {report.url && (
          <div className="flex items-center gap-2 rounded-md bg-background/50 border border-border px-3 py-2">
            <Rocket className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <a
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate font-mono text-xs text-emerald-300 hover:underline"
            >
              {report.url}
            </a>
            <button
              onClick={copyUrl}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy URL"
            >
              {copied
                ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Open in browser"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded px-1.5 py-0.5 bg-muted capitalize text-foreground/60">
            {report.environment}
          </span>
          <span>{report.projectName}</span>
          <span className="text-muted-foreground/60">
            {new Date(report.deployedAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Error message */}
        {report.error && (
          <p className="text-xs text-red-400">{report.error}</p>
        )}

        {/* Token hint when failed */}
        {!report.success && (
          <p className="text-xs text-muted-foreground">
            Add your Vercel token in <span className="text-foreground font-medium">Settings → Vercel Token</span> and retry.
          </p>
        )}
      </div>

      {/* CLI output */}
      {report.output && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Vercel output</span>
          </div>
          <pre className="max-h-48 overflow-y-auto p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
            {report.output}
          </pre>
        </div>
      )}
    </div>
  )
}
