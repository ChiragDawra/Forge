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

export interface RepomixFile {
  path: string
  chars: number
}

export interface RepomixSummary {
  root: string
  totalFiles: number
  totalChars: number
  estimatedTokens: number
  topFiles: RepomixFile[]
  rawXmlPath?: string
}

export interface Context7Response {
  library: string
  topic: string | null
  content: string
  source: string
  fetchedAt: number
}

export interface AtomicTask {
  id: number
  title: string
  rationale: string
  estimate: 'S' | 'M' | 'L'
  dependsOn: number[]
}

export interface DecomposeResult {
  goal: string
  tasks: AtomicTask[]
  model: string
  costUsd: number
}

export interface SessionLogResult {
  outPath: string
  sessionId: string
  projectId: string | null
  durationMs: number | null
  totalCostUsd: number
  totalCalls: number
  bytesWritten: number
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
    repomix(projectRoot: string, ignore?: string[]): Promise<RepomixSummary>
    context7(library: string, topic?: string, tokens?: number): Promise<Context7Response>
  }
  agent: {
    decompose(goal: string, projectId?: string, phaseId?: string): Promise<DecomposeResult>
    writeSessionLog(
      sessionId: string,
      outPath: string,
      narrative?: string
    ): Promise<SessionLogResult>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ForgeApi
  }
}
