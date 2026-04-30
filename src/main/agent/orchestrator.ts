// Central orchestrator — runs the 9-phase pipeline in order.
// Each phase follows the pattern:
//   1. emit 'phase:start'
//   2. run phase module
//   3. emit 'phase:done' or 'phase:error'
//   4. if phase requires approval, emit 'phase:waiting' and pause
//      until orchestrator.approve() is called
//
// The orchestrator is stateful within a session. The IPC layer holds
// a single instance per project; cancel() destroys it.

import { EventEmitter } from 'events'

export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed' | 'waiting'

export interface PhaseInfo {
  index: number
  name: string
  status: PhaseStatus
  error?: string
  startedAt?: number
  completedAt?: number
}

export interface OrchestratorEvent {
  type:
    | 'phase:start'
    | 'phase:done'
    | 'phase:error'
    | 'phase:waiting'
    | 'phase:approved'
    | 'log'
    | 'pipeline:done'
    | 'pipeline:cancelled'
  phaseIndex?: number
  phaseName?: string
  message?: string
  level?: 'info' | 'warn' | 'error'
  phases?: PhaseInfo[]
}

export type OrchestratorListener = (event: OrchestratorEvent) => void

// Phase registry — names match the phase module filenames.
const PHASE_NAMES = [
  'Intake',       // 0
  'Planning',     // 1
  'Design',       // 2
  'Scaffold',     // 3
  'Codegen',      // 4
  'Review',       // 5
  'Security',     // 6
  'Testing',      // 7
  'Deploy'        // 8
]

// Phases that pause and wait for user approval before continuing.
const APPROVAL_REQUIRED = new Set([0, 1, 2, 3, 5, 6, 7, 8])

export class Orchestrator extends EventEmitter {
  private readonly projectId: string
  private phases: PhaseInfo[]
  private cancelled = false
  private approvalResolve: (() => void) | null = null

  constructor(projectId: string) {
    super()
    this.projectId = projectId
    this.phases = PHASE_NAMES.map((name, index) => ({
      index,
      name,
      status: 'pending'
    }))
  }

  get phaseSnapshot(): PhaseInfo[] {
    return this.phases.map((p) => ({ ...p }))
  }

  /**
   * Run the full pipeline starting from `startPhase`.
   * Resolves when all phases complete or the pipeline is cancelled.
   */
  async run(
    startPhase = 0,
    runPhase: (index: number, projectId: string, log: (msg: string) => void) => Promise<void>
  ): Promise<void> {
    for (let i = startPhase; i < PHASE_NAMES.length; i++) {
      if (this.cancelled) break

      this._setStatus(i, 'running')
      this._emit({ type: 'phase:start', phaseIndex: i, phaseName: PHASE_NAMES[i], phases: this.phaseSnapshot })
      this._log(`Starting phase ${i}: ${PHASE_NAMES[i]}`, 'info')

      try {
        await runPhase(i, this.projectId, (msg) => this._log(msg, 'info'))
        this._setStatus(i, APPROVAL_REQUIRED.has(i) ? 'waiting' : 'done')

        if (APPROVAL_REQUIRED.has(i) && !this.cancelled) {
          this._emit({ type: 'phase:waiting', phaseIndex: i, phaseName: PHASE_NAMES[i], phases: this.phaseSnapshot })
          this._log(`Phase ${i} awaiting approval…`, 'info')
          await this._waitForApproval()
          if (this.cancelled) break
          this._setStatus(i, 'done')
          this._emit({ type: 'phase:approved', phaseIndex: i, phaseName: PHASE_NAMES[i], phases: this.phaseSnapshot })
        } else {
          this._emit({ type: 'phase:done', phaseIndex: i, phaseName: PHASE_NAMES[i], phases: this.phaseSnapshot })
        }
        this._log(`Phase ${i} complete`, 'info')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this._setStatus(i, 'failed', message)
        this._log(`Phase ${i} failed: ${message}`, 'error')
        this._emit({ type: 'phase:error', phaseIndex: i, phaseName: PHASE_NAMES[i], message, phases: this.phaseSnapshot })
        break
      }
    }

    if (this.cancelled) {
      this._emit({ type: 'pipeline:cancelled', phases: this.phaseSnapshot })
    } else {
      this._emit({ type: 'pipeline:done', phases: this.phaseSnapshot })
    }
  }

  /** Unblock a phase waiting for approval. */
  approve(): void {
    if (this.approvalResolve) {
      this.approvalResolve()
      this.approvalResolve = null
    }
  }

  /** Cancel the pipeline — aborts after the current phase finishes. */
  cancel(): void {
    this.cancelled = true
    this.approve() // unblock if waiting for approval
  }

  // ── Private helpers ────────────────────────────────────────────────

  private _setStatus(index: number, status: PhaseStatus, error?: string): void {
    const p = this.phases[index]
    if (!p) return
    p.status = status
    if (status === 'running') p.startedAt = Date.now()
    if (status === 'done' || status === 'failed') p.completedAt = Date.now()
    if (error) p.error = error
  }

  private _emit(event: OrchestratorEvent): void {
    this.emit('event', event)
  }

  private _log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this._emit({ type: 'log', message, level })
  }

  private _waitForApproval(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.approvalResolve = resolve
    })
  }
}

// Module-level registry: one orchestrator per projectId.
const registry = new Map<string, Orchestrator>()

export function getOrCreateOrchestrator(projectId: string): Orchestrator {
  let o = registry.get(projectId)
  if (!o) {
    o = new Orchestrator(projectId)
    registry.set(projectId, o)
  }
  return o
}

export function destroyOrchestrator(projectId: string): void {
  const o = registry.get(projectId)
  if (o) {
    o.cancel()
    o.removeAllListeners()
    registry.delete(projectId)
  }
}
