import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Rocket, Loader2, CheckCircle2, Play } from 'lucide-react'
import { useProjectsStore } from '@renderer/lib/stores/projects'
import PromptInput from '@renderer/components/project/PromptInput'
import ApprovalGate from '@renderer/components/project/ApprovalGate'
import PlanViewer from '@renderer/components/project/PlanViewer'
import PhaseTracker from '@renderer/components/project/PhaseTracker'
import LogStream, { eventToLogLine } from '@renderer/components/project/LogStream'
import DesignPhase, { DesignPhaseSkeleton } from '@renderer/components/project/DesignPhase'
import ScaffoldViewer from '@renderer/components/project/ScaffoldViewer'
import type { LogLine } from '@renderer/components/project/LogStream'
import type {
  ProjectRow,
  IntakeDraft,
  IntakeJson,
  PlanningResult,
  DesignResult,
  ScaffoldResult,
  PhaseInfo,
  OrchestratorEvent
} from '../../../preload/index.d'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function Project(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { createProject } = useProjectsStore()

  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Existing project view
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)

  useEffect(() => {
    if (id && id !== 'new') {
      // Security: validate UUID format before sending to IPC
      if (!UUID_RE.test(id)) {
        navigate('/')
        return
      }
      setLoadingProject(true)
      window.api?.projects
        ?.get(id)
        .then((p) => setProject(p))
        .catch(() => setProject(null))
        .finally(() => setLoadingProject(false))
    }
  }, [id, navigate])

  async function handleCreate(): Promise<void> {
    if (!name.trim() || !prompt.trim()) {
      setError('Name and prompt are required')
      return
    }
    setCreating(true)
    setError(null)
    const result = await createProject(name.trim(), prompt.trim())
    setCreating(false)
    if (result) {
      navigate(`/project/${result.id}`)
    } else {
      setError('Failed to create project')
    }
  }

  if (id === 'new') {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Project</h2>
          <p className="text-sm text-muted-foreground">
            Describe your app in one prompt and Forge will build it.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Project Name</label>
            <input
              type="text"
              placeholder="My Awesome App"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prompt</label>
            <textarea
              placeholder="Build me a SaaS dashboard for tracking freelance projects with auth, payments, and a kanban board..."
              value={prompt}
              maxLength={10000}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Create Project
          </button>
        </div>
      </div>
    )
  }

  // Intake phase state (Day 8)
  const [intakeBusy, setIntakeBusy] = useState(false)
  const [intakeDraft, setIntakeDraft] = useState<IntakeDraft | null>(null)
  const [intakeResult, setIntakeResult] = useState<IntakeJson | null>(null)
  const [intakeError, setIntakeError] = useState<string | null>(null)
  const [gateOpen, setGateOpen] = useState(false)

  async function runIntake(raw: string): Promise<void> {
    if (!id || id === 'new') return
    setIntakeBusy(true)
    setIntakeError(null)
    try {
      const draft = await window.api.phases.intakeRun(raw, id)
      setIntakeDraft(draft)
      setGateOpen(true)
    } catch (e) {
      setIntakeError(e instanceof Error ? e.message : 'Intake failed')
    } finally {
      setIntakeBusy(false)
    }
  }

  async function finaliseIntake(
    answers: { id: number; answer: string }[]
  ): Promise<void> {
    if (!id || id === 'new' || !intakeDraft) return
    setIntakeBusy(true)
    setIntakeError(null)
    try {
      const { intake } = await window.api.phases.intakeFinalise(intakeDraft, answers, id)
      setIntakeResult(intake)
      setGateOpen(false)
    } catch (e) {
      setIntakeError(e instanceof Error ? e.message : 'Finalise failed')
    } finally {
      setIntakeBusy(false)
    }
  }

  // Planning phase state (Day 9)
  const [planningBusy, setPlanningBusy] = useState(false)
  const [planningResult, setPlanningResult] = useState<PlanningResult | null>(null)
  const [planningError, setPlanningError] = useState<string | null>(null)

  async function runPlanning(intake: IntakeJson): Promise<void> {
    if (!id || id === 'new') return
    setPlanningBusy(true)
    setPlanningError(null)
    try {
      const result = await window.api.phases.planningRun(
        { expanded: intake.expanded, clarifications: intake.clarifications },
        id
      )
      setPlanningResult(result)
    } catch (e) {
      setPlanningError(e instanceof Error ? e.message : 'Planning failed')
    } finally {
      setPlanningBusy(false)
    }
  }

  // Design phase state (Day 11)
  const [designBusy, setDesignBusy] = useState(false)
  const [designResult, setDesignResult] = useState<DesignResult | null>(null)
  const [designError, setDesignError] = useState<string | null>(null)

  async function runDesign(): Promise<void> {
    if (!id || id === 'new') return
    setDesignBusy(true)
    setDesignError(null)
    try {
      const result = await window.api.phases.designRun(id)
      setDesignResult(result)
    } catch (e) {
      setDesignError(e instanceof Error ? e.message : 'Design phase failed')
    } finally {
      setDesignBusy(false)
    }
  }

  // Scaffold phase state (Day 12)
  const [scaffoldBusy, setScaffoldBusy] = useState(false)
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResult | null>(null)
  const [scaffoldError, setScaffoldError] = useState<string | null>(null)

  async function runScaffold(): Promise<void> {
    if (!id || id === 'new' || !project) return
    setScaffoldBusy(true)
    setScaffoldError(null)
    try {
      const result = await window.api.phases.scaffoldRun(project.name, id)
      setScaffoldResult(result)
    } catch (e) {
      setScaffoldError(e instanceof Error ? e.message : 'Scaffold phase failed')
    } finally {
      setScaffoldBusy(false)
    }
  }

  // Orchestrator state (Day 10)
  const [orchPhases, setOrchPhases] = useState<PhaseInfo[]>([])
  const [logLines, setLogLines] = useState<LogLine[]>([])
  const [orchRunning, setOrchRunning] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  function subscribeOrchestrator(): void {
    if (unsubRef.current) return
    unsubRef.current = window.api.orchestrator.onEvent((evt: OrchestratorEvent) => {
      if (evt.phases) setOrchPhases(evt.phases)
      const line = eventToLogLine(evt)
      if (line) setLogLines((prev) => [...prev, line])
      if (evt.type === 'pipeline:done' || evt.type === 'pipeline:cancelled') {
        setOrchRunning(false)
      }
    })
  }

  async function startPipeline(): Promise<void> {
    if (!id || id === 'new') return
    setLogLines([])
    subscribeOrchestrator()
    setOrchRunning(true)
    const res = await window.api.orchestrator.start(id, 0)
    setOrchPhases(res.phases)
  }

  async function approvePipeline(): Promise<void> {
    if (!id || id === 'new') return
    await window.api.orchestrator.approve(id)
  }

  async function cancelPipeline(): Promise<void> {
    if (!id || id === 'new') return
    await window.api.orchestrator.cancel(id)
    setOrchRunning(false)
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
  }

  // Clean up listener on unmount
  useEffect(() => {
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null } }
  }, [])

  // Existing project view
  if (loadingProject) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Project not found</h2>
        <p className="text-sm text-muted-foreground">
          This project doesn&apos;t exist or couldn&apos;t be loaded.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
            {project.status}
          </span>
          <span className="text-xs text-muted-foreground">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">Prompt</p>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
          {project.prompt}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            Phase 0
          </span>
          <h3 className="text-sm font-semibold">Intake</h3>
        </div>

        {intakeResult ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Intake approved
            </div>
            <p className="text-sm whitespace-pre-wrap">{intakeResult.expanded}</p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">
                {intakeResult.clarifications.length} clarifications
              </summary>
              <ul className="mt-2 space-y-2">
                {intakeResult.clarifications.map((c, i) => (
                  <li key={i} className="space-y-0.5">
                    <p className="font-medium text-foreground">{c.question}</p>
                    <p>{c.answer || <em>(skipped)</em>}</p>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : (
          <PromptInput
            onSubmit={runIntake}
            busy={intakeBusy}
            initial={project.prompt}
          />
        )}

        {intakeError ? (
          <p className="text-sm text-destructive">{intakeError}</p>
        ) : null}
      </div>

      {/* Phase 1: Planning — visible once intake is approved */}
      {intakeResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Phase 1
              </span>
              <h3 className="text-sm font-semibold">Planning</h3>
            </div>
            {!planningResult && (
              <button
                onClick={() => runPlanning(intakeResult)}
                disabled={planningBusy}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {planningBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {planningBusy ? 'Generating…' : 'Run Planning'}
              </button>
            )}
          </div>

          {planningResult ? (
            <PlanViewer result={planningResult} />
          ) : planningBusy ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating PRD and architecture…
            </div>
          ) : null}

          {planningError && (
            <p className="text-sm text-destructive">{planningError}</p>
          )}
        </div>
      )}

      {/* Phase 2: Design — visible once planning is done */}
      {planningResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Phase 2</span>
              <h3 className="text-sm font-semibold">Design</h3>
            </div>
            {!designResult && (
              <button
                onClick={runDesign}
                disabled={designBusy}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {designBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {designBusy ? 'Generating…' : 'Run Design'}
              </button>
            )}
          </div>
          {designResult ? <DesignPhase result={designResult} /> : designBusy ? <DesignPhaseSkeleton /> : null}
          {designError && <p className="text-sm text-destructive">{designError}</p>}
        </div>
      )}

      {/* Phase 3: Scaffold — visible once design is done */}
      {designResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Phase 3</span>
              <h3 className="text-sm font-semibold">Scaffold</h3>
            </div>
            {!scaffoldResult && (
              <button
                onClick={runScaffold}
                disabled={scaffoldBusy}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {scaffoldBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {scaffoldBusy ? 'Generating…' : 'Run Scaffold'}
              </button>
            )}
          </div>
          {scaffoldResult ? (
            <ScaffoldViewer result={scaffoldResult} />
          ) : scaffoldBusy ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating project scaffold…
            </div>
          ) : null}
          {scaffoldError && <p className="text-sm text-destructive">{scaffoldError}</p>}
        </div>
      )}

      {/* Pipeline orchestrator — visible once planning is done */}
      {planningResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pipeline</h3>
            {!orchRunning && orchPhases.length === 0 && (
              <button
                onClick={startPipeline}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Play className="h-3.5 w-3.5" />
                Run full pipeline
              </button>
            )}
          </div>

          {orchPhases.length > 0 && (
            <PhaseTracker
              phases={orchPhases}
              onApprove={orchRunning ? approvePipeline : undefined}
              onCancel={orchRunning ? cancelPipeline : undefined}
            />
          )}

          {logLines.length > 0 && <LogStream lines={logLines} />}
        </div>
      )}

      <ApprovalGate
        open={gateOpen}
        draft={intakeDraft}
        busy={intakeBusy}
        onCancel={() => setGateOpen(false)}
        onEdit={() => {
          setGateOpen(false)
          setIntakeDraft(null)
        }}
        onApprove={finaliseIntake}
      />
    </div>
  )
}
