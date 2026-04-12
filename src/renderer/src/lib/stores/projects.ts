import { create } from 'zustand'
import type { ProjectRow } from '../../../../preload/index.d'

interface ProjectsState {
  projects: ProjectRow[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  createProject: (name: string, prompt: string) => Promise<ProjectRow | null>
}

function hasApi(): boolean {
  return typeof window.api?.projects !== 'undefined'
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  fetch: async () => {
    if (!hasApi()) {
      set({ loading: false, error: 'Open in Electron app to use projects' })
      return
    }
    set({ loading: true, error: null })
    try {
      const projects = await window.api.projects.list()
      set({ projects, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  createProject: async (name: string, prompt: string) => {
    if (!hasApi()) return null
    try {
      const project = await window.api.projects.create(name, prompt)
      // Refresh the list
      await get().fetch()
      return project
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
  }
}))
