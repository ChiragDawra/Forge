import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Loader2, Clock } from 'lucide-react'
import { useProjectsStore } from '@renderer/lib/stores/projects'

export default function Home(): React.JSX.Element {
  const navigate = useNavigate()
  const { projects, loading, fetch } = useProjectsStore()

  useEffect(() => {
    fetch()
  }, [fetch])

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Create a new project or continue an existing one.
          </p>
        </div>
        <button
          onClick={() => navigate('/project/new')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <FolderOpen className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click &quot;New Project&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground truncate">{project.prompt}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                  {project.status}
                </span>
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
