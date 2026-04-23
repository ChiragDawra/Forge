import type { ElectronAPI } from '@electron-toolkit/preload'

export interface ProjectRow {
  id: string
  name: string
  prompt: string
  status: string
  techStack: string | null
  createdAt: number
  updatedAt: number
}

export interface ModelResponse {
  content: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  model: string
}

export interface UsageSummaryRow {
  modelName: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  callCount: number
  lastUsedAt: number | null
}

export interface DailyUsageRow {
  date: string // YYYY-MM-DD local
  modelName: string
  totalCostUsd: number
  totalTokens: number
  callCount: number
}

export interface UsageRow {
  id: string
  modelName: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  calledAt: number
  projectId: string | null
  phaseId: string | null
}

export type TaskType =
  | 'intake'
  | 'planning'
  | 'codegen'
  | 'review'
  | 'security'
  | 'testing'
  | 'deploy'
  | 'generic'

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface RepomixFile {
  path: string
  content: string
}

export interface RepomixSummary {
  totalFiles: number
  totalLines: number
}

export interface LibraryMatch {
  id: string
  name: string
  description: string
}

export interface DocsResult {
  libraryId: string
  topic: string
  content: string
  tokenCount: number
}

export interface AgentTask {
  id: string
  phaseSlug: string
  title: string
  prompt: string
  taskType: TaskType
  status: TaskStatus
  dependsOn: string[]
  result: ModelResponse | null
  error: string | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
}

export interface DecomposeResult {
  phaseSlug: string
  tasks: AgentTask[]
}

export interface QueueSummary {
  total: number
  pending: number
  running: number
  done: number
  failed: number
  skipped: number
}

export interface SessionEntry {
  phaseSlug: string
  tasks: { title: string; status: string; taskType: string; durationMs: number | null }[]
  startedAt: number
  completedAt: number
}

export interface LogSessionResult {
  entry: SessionEntry
  logPath: string
  markdown: string
}

export interface IntakeQuestion {
  id: number
  question: string
  why: string
}

export interface IntakeDraft {
  rawIdea: string
  expanded: string
  questions: IntakeQuestion[]
  model: string
  costUsd: number
}

export interface IntakeAnswer {
  id: number
  answer: string
}

export interface IntakeJson {
  rawIdea: string
  expanded: string
  clarifications: { question: string; answer: string }[]
  finalisedAt: number
}

export interface ForgeApi {
  projects: {
    create(name: string, prompt: string): Promise<ProjectRow>
    list(): Promise<ProjectRow[]>
    get(id: string): Promise<ProjectRow | null>
  }
  settings: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
  }
  ai: {
    call(taskType: TaskType, prompt: string, projectId?: string, phaseId?: string): Promise<ModelResponse>
    reinit(): Promise<void>
    usageSummary(): Promise<UsageSummaryRow[]>
    usageDaily(days?: number): Promise<DailyUsageRow[]>
    totalCost(): Promise<number>
    usageByProject(projectId: string): Promise<UsageRow[]>
  }
  tools: {
    repomix(targetDir: string, include?: string, ignore?: string): Promise<{ files: RepomixFile[]; summary: RepomixSummary }>
    repomixToFile(targetDir: string, savePath: string, include?: string, ignore?: string): Promise<{ summary: RepomixSummary }>
    context7Resolve(libraryName: string): Promise<LibraryMatch[]>
    context7Docs(libraryId: string, topic: string, maxTokens?: number): Promise<DocsResult>
    context7Lookup(libraryName: string, topic: string, maxTokens?: number): Promise<DocsResult>
  }
  agent: {
    decompose(phaseSlug: string, phaseGoal: string, projectId?: string): Promise<DecomposeResult>
    executeQueue(phaseSlug: string, projectId?: string): Promise<AgentTask[]>
    queue(phaseSlug: string): Promise<AgentTask[]>
    queueSummary(phaseSlug: string): Promise<QueueSummary>
    clearQueue(phaseSlug: string): Promise<void>
    logSession(projectRoot: string, phaseSlug: string, dayNumber: number, projectId?: string): Promise<LogSessionResult>
    sessions(): Promise<SessionEntry[]>
  }
  phases: {
    intakeRun(rawIdea: string, projectId?: string): Promise<IntakeDraft>
    intakeFinalise(
      draft: IntakeDraft,
      answers: IntakeAnswer[],
      projectId: string
    ): Promise<{ intake: IntakeJson; path: string }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ForgeApi
  }
}
