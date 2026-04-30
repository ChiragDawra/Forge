import { useEffect, useRef } from 'react'
import type { OrchestratorEvent } from '../../../../preload/index.d'

interface LogLine {
  ts: number
  message: string
  level: 'info' | 'warn' | 'error'
}

interface LogStreamProps {
  lines: LogLine[]
  maxLines?: number
}

export type { LogLine }

/**
 * Terminal-style log stream. Auto-scrolls to bottom on new lines.
 * The parent is responsible for collecting lines from onEvent() and
 * passing them in — this component is purely presentational.
 */
export default function LogStream({ lines, maxLines = 200 }: LogStreamProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)
  const visible = lines.slice(-maxLines)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  if (lines.length === 0) {
    return (
      <div className="rounded-md border border-border bg-black/40 px-4 py-3 text-xs text-muted-foreground font-mono">
        Waiting for log output…
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-black/40 max-h-56 overflow-y-auto font-mono text-xs leading-5 p-3 space-y-0.5">
      {visible.map((line, i) => (
        <div
          key={i}
          className={
            line.level === 'error'
              ? 'text-red-400'
              : line.level === 'warn'
              ? 'text-amber-400'
              : 'text-green-300/80'
          }
        >
          <span className="mr-2 text-muted-foreground/40 select-none">
            {new Date(line.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {line.message}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

/**
 * Helper: convert an OrchestratorEvent to a LogLine if it carries
 * loggable content. Returns null for structural events with no message.
 */
export function eventToLogLine(evt: OrchestratorEvent): LogLine | null {
  if (evt.type === 'log' && evt.message) {
    return { ts: Date.now(), message: evt.message, level: evt.level ?? 'info' }
  }
  if (evt.type === 'phase:start' && evt.phaseName) {
    return { ts: Date.now(), message: `▶ Phase ${evt.phaseIndex}: ${evt.phaseName} started`, level: 'info' }
  }
  if (evt.type === 'phase:done' && evt.phaseName) {
    return { ts: Date.now(), message: `✓ Phase ${evt.phaseIndex}: ${evt.phaseName} complete`, level: 'info' }
  }
  if (evt.type === 'phase:waiting' && evt.phaseName) {
    return { ts: Date.now(), message: `⏸ Phase ${evt.phaseIndex}: ${evt.phaseName} awaiting approval`, level: 'warn' }
  }
  if (evt.type === 'phase:approved' && evt.phaseName) {
    return { ts: Date.now(), message: `▶ Phase ${evt.phaseIndex}: ${evt.phaseName} approved — continuing`, level: 'info' }
  }
  if (evt.type === 'phase:error') {
    return { ts: Date.now(), message: `✗ Phase ${evt.phaseIndex} error: ${evt.message ?? 'unknown'}`, level: 'error' }
  }
  if (evt.type === 'pipeline:done') {
    return { ts: Date.now(), message: '🎉 Pipeline complete', level: 'info' }
  }
  if (evt.type === 'pipeline:cancelled') {
    return { ts: Date.now(), message: '⏹ Pipeline cancelled', level: 'warn' }
  }
  return null
}
