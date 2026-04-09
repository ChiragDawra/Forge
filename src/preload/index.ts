import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Expose electron API to renderer
contextBridge.exposeInMainWorld('electron', electronAPI)

// Expose typed IPC bridge — handlers added in future sessions
contextBridge.exposeInMainWorld('api', {
  // Projects IPC (Day 4)
  // Settings IPC (Day 3)
  // Agent IPC (Day 8+)
  // Models IPC (Day 6)
})
