import { useParams } from 'react-router-dom'

export default function Project(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">
        {id === 'new' ? 'New Project' : `Project ${id}`}
      </h2>
      <p className="text-sm text-muted-foreground">
        {id === 'new'
          ? 'Describe your app in one prompt and Forge will build it.'
          : 'Project details and phase pipeline will appear here.'}
      </p>

      {id === 'new' && (
        <div className="space-y-3">
          <textarea
            placeholder="Build me a SaaS dashboard for tracking freelance projects with auth..."
            className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
          >
            Start Building (Day 8+)
          </button>
        </div>
      )}
    </div>
  )
}
