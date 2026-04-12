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
  // Agent IPC (Day 8+)
  // Models IPC (Day 6)
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ForgeApi
  }
}
