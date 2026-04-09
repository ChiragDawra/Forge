import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ForgeApi } from './index.d'

// Typed IPC bridge — handlers added in future sessions
const api: ForgeApi = {
  // Projects IPC (Day 4)
  // Settings IPC (Day 3)
  // Agent IPC (Day 8+)
  // Models IPC (Day 6)
}

// Expose to the renderer through the contextBridge
contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
