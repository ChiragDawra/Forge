import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Rocket, Loader2 } from 'lucide-react'
import { useProjectsStore } from '@renderer/lib/stores/projects'
import type { ProjectRow } from '../../../preload/index.d'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function Project(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { createProject } = useProjectsStore()

  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Existing project view
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)

  useEffect(() => {
    if (id && id !== 'new') {
      // Security: validate UUID format before sending to IPC
      if (!UUID_RE.test(id)) {
        navigate('/')
        return
      }
      setLoadingProject(true)
      window.api?.projects
        ?.get(id)
        .then((p) => setProject(p))
        .catch(() => setProject(null))
        .finally(() => setLoadingProject(false))
    }
  }, [id, navigate])

  async function handleCreate(): Promise<void> {
    if (!name.trim() || !prompt.trim()) {
      setError('Name and prompt are required')
      return
    }
    setCreating(true)
    setError(null)
    const result = await createProject(name.trim(), prompt.trim())
    setCreating(false)
    if (result) {
      navigate(`/project/${result.id}`)
    } else {
      setError('Failed to create project')
    }
  }

  if (id === 'new') {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Project</h2>
          <p className="text-sm text-muted-foreground">
            Describe your app in one prompt and Forge will build it.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Project Name</label>
            <input
              type="text"
              placeholder="My Awesome App"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prompt</label>
            <textarea
              placeholder="Build me a SaaS dashboard for tracking freelance projects with auth, payments, and a kanban board..."
              value={prompt}
              maxLength={10000}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Create Project
          </button>
        </div>
      </div>
    )
  }

  // Existing project view
  if (loadingProject) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Project not found</h2>
        <p className="text-sm text-muted-foreground">
          This project doesn&apos;t exist or couldn&apos;t be loaded.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
            {project.status}
          </span>
          <span className="text-xs text-muted-foreground">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">Prompt</p>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
          {project.prompt}
        </div>
      </div>

      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Phase pipeline will appear here (Day 8+)
      </div>
    </div>
  )
}
