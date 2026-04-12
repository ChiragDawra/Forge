import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ForgeApi } from './index.d'

const api: ForgeApi = {
  projects: {
    create: (name: string, prompt: string) => ipcRenderer.invoke('projects:create', name, prompt),
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('settings:delete', key)
  }
  // Agent IPC (Day 8+)
  // Models IPC (Day 6)
}

// Expose to the renderer through the contextBridge
contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
