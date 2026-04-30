import { Check, Loader2, Clock, XCircle, AlertCircle } from 'lucide-react'
import type { PhaseInfo, PhaseStatus } from '../../../../preload/index.d'

interface PhaseTrackerProps {
  phases: PhaseInfo[]
  onApprove?: () => void
  onCancel?: () => void
  busy?: boolean
}

const STATUS_ICON: Record<PhaseStatus, React.ReactNode> = {
  pending:  <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />,
  running:  <Loader2 className="h-5 w-5 animate-spin text-primary" />,
  waiting:  <AlertCircle className="h-5 w-5 text-amber-400" />,
  done:     <Check className="h-5 w-5 text-emerald-400" />,
  failed:   <XCircle className="h-5 w-5 text-destructive" />
}

const STATUS_LABEL: Record<PhaseStatus, string> = {
  pending: 'Pending',
  running: 'Running…',
  waiting: 'Awaiting approval',
  done:    'Done',
  failed:  'Failed'
}

export default function PhaseTracker({
  phases,
  onApprove,
  onCancel,
  busy = false
}: PhaseTrackerProps): React.JSX.Element {
  const waitingPhase = phases.find((p) => p.status === 'waiting')
  const runningPhase = phases.find((p) => p.status === 'running')
  const active = waitingPhase ?? runningPhase

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5">
        <span className="text-sm font-semibold">Pipeline</span>
        {active && (
          <span className="text-xs text-muted-foreground">
            {waitingPhase ? `Phase ${waitingPhase.index}: ${waitingPhase.name} awaiting approval` : `Phase ${runningPhase!.index}: ${runningPhase!.name} running`}
          </span>
        )}
      </div>

      <ol className="divide-y divide-border">
        {phases.map((phase) => (
          <li
            key={phase.index}
            className={`flex items-start gap-3 px-4 py-2.5 text-sm ${
              phase.status === 'running' || phase.status === 'waiting'
                ? 'bg-primary/5'
                : ''
            }`}
          >
            <span className="mt-0.5 shrink-0">{STATUS_ICON[phase.status]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${phase.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                  {phase.index}. {phase.name}
                </span>
                <span className={`text-xs ${
                  phase.status === 'done' ? 'text-emerald-400' :
                  phase.status === 'failed' ? 'text-destructive' :
                  phase.status === 'waiting' ? 'text-amber-400' :
                  phase.status === 'running' ? 'text-primary' :
                  'text-muted-foreground'
                }`}>
                  {STATUS_LABEL[phase.status]}
                </span>
                {phase.startedAt && phase.completedAt && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {((phase.completedAt - phase.startedAt) / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {phase.error && (
                <p className="mt-0.5 text-xs text-destructive truncate">{phase.error}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {(onApprove || onCancel) && (
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {onApprove && waitingPhase && (
            <button
              onClick={onApprove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              Approve &amp; continue
            </button>
          )}
        </div>
      )}
    </div>
  )
}
