import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ForgeApi } from './index.d'

const api: ForgeApi = {
  projects: {
    create: (name, prompt) => ipcRenderer.invoke('projects:create', name, prompt),
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id) => ipcRenderer.invoke('projects:get', id)
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    delete: (key) => ipcRenderer.invoke('settings:delete', key)
  },
  ai: {
    call: (taskType, prompt, projectId, phaseId) =>
      ipcRenderer.invoke('ai:call', taskType, prompt, projectId, phaseId),
    reinit: () => ipcRenderer.invoke('ai:reinit'),
    usageSummary: () => ipcRenderer.invoke('ai:usage-summary'),
    totalCost: () => ipcRenderer.invoke('ai:total-cost'),
    usageByProject: (projectId) => ipcRenderer.invoke('ai:usage-by-project', projectId)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
