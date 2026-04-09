import type { ElectronAPI } from '@electron-toolkit/preload'

export interface ForgeApi {
  // Projects IPC (Day 4)
  // Settings IPC (Day 3)
  // Agent IPC (Day 8+)
  // Models IPC (Day 6)
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ForgeApi
  }
}
