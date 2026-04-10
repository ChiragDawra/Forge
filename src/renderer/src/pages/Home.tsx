import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen } from 'lucide-react'

export default function Home(): React.JSX.Element {
  const navigate = useNavigate()

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

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <FolderOpen className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click &quot;New Project&quot; to get started.
        </p>
      </div>
    </div>
  )
}
