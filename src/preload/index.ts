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
    usageDaily: (days) => ipcRenderer.invoke('ai:usage-daily', days),
    totalCost: () => ipcRenderer.invoke('ai:total-cost'),
    usageByProject: (projectId) => ipcRenderer.invoke('ai:usage-by-project', projectId)
  },
  tools: {
    repomix: (targetDir, include, ignore) =>
      ipcRenderer.invoke('tools:repomix', targetDir, include, ignore),
    repomixToFile: (targetDir, savePath, include, ignore) =>
      ipcRenderer.invoke('tools:repomix-to-file', targetDir, savePath, include, ignore),
    context7Resolve: (libraryName) =>
      ipcRenderer.invoke('tools:context7-resolve', libraryName),
    context7Docs: (libraryId, topic, maxTokens) =>
      ipcRenderer.invoke('tools:context7-docs', libraryId, topic, maxTokens),
    context7Lookup: (libraryName, topic, maxTokens) =>
      ipcRenderer.invoke('tools:context7-lookup', libraryName, topic, maxTokens)
  },
  agent: {
    decompose: (phaseSlug, phaseGoal, projectId) =>
      ipcRenderer.invoke('agent:decompose', phaseSlug, phaseGoal, projectId),
    executeQueue: (phaseSlug, projectId) =>
      ipcRenderer.invoke('agent:execute-queue', phaseSlug, projectId),
    queue: (phaseSlug) => ipcRenderer.invoke('agent:queue', phaseSlug),
    queueSummary: (phaseSlug) => ipcRenderer.invoke('agent:queue-summary', phaseSlug),
    clearQueue: (phaseSlug) => ipcRenderer.invoke('agent:clear-queue', phaseSlug),
    logSession: (projectRoot, phaseSlug, dayNumber, projectId) =>
      ipcRenderer.invoke('agent:log-session', projectRoot, phaseSlug, dayNumber, projectId),
    sessions: () => ipcRenderer.invoke('agent:sessions')
  },
  phases: {
    intakeRun: (rawIdea, projectId) =>
      ipcRenderer.invoke('phases:intake:run', rawIdea, projectId),
    intakeFinalise: (draft, answers, projectId) =>
      ipcRenderer.invoke('phases:intake:finalise', draft, answers, projectId),
    planningRun: (input, projectId) =>
      ipcRenderer.invoke('phases:planning:run', input, projectId),
    designRun: (projectId) =>
      ipcRenderer.invoke('phases:design:run', projectId),
    scaffoldRun: (projectName, projectId) =>
      ipcRenderer.invoke('phases:scaffold:run', projectName, projectId),
    codegenRun: (projectId, scaffoldSlug) =>
      ipcRenderer.invoke('phases:codegen:run', projectId, scaffoldSlug),
    reviewRun: (projectId, scaffoldSlug) =>
      ipcRenderer.invoke('phases:review:run', projectId, scaffoldSlug),
    securityRun: (projectId, scaffoldSlug) =>
      ipcRenderer.invoke('phases:security:run', projectId, scaffoldSlug),
    testingRun: (projectId, scaffoldSlug) =>
      ipcRenderer.invoke('phases:testing:run', projectId, scaffoldSlug)
  },
  orchestrator: {
    start: (projectId, startPhase) =>
      ipcRenderer.invoke('orchestrator:start', projectId, startPhase),
    approve: (projectId) => ipcRenderer.invoke('orchestrator:approve', projectId),
    cancel: (projectId) => ipcRenderer.invoke('orchestrator:cancel', projectId),
    phases: (projectId) => ipcRenderer.invoke('orchestrator:phases', projectId),
    onEvent: (cb) => {
      const handler = (_e: Electron.IpcRendererEvent, evt: unknown) => cb(evt)
      ipcRenderer.on('orchestrator:event', handler)
      return () => ipcRenderer.removeListener('orchestrator:event', handler)
    }
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
