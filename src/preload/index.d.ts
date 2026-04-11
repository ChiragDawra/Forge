import type { ElectronAPI } from '@electron-toolkit/preload'

export interface ForgeApi {
  // Projects IPC (Day 4)
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
