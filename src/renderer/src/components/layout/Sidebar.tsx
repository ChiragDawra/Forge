import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Settings, BarChart3, Hammer, FolderOpen } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjectsStore } from '@renderer/lib/stores/projects'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/models', label: 'Models', icon: BarChart3 }
] as const

export default function Sidebar(): React.JSX.Element {
  const { projects, fetch } = useProjectsStore()

  useEffect(() => {
    fetch()
  }, [fetch])

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo / drag region */}
      <div className="drag-region flex items-center gap-2 px-4 py-4">
        <Hammer className="h-5 w-5 text-primary no-drag" />
        <span className="text-lg font-semibold tracking-tight no-drag">Forge</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Projects list */}
      <div className="mt-6 flex-1 overflow-y-auto px-2">
        <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Projects
        </p>
        {projects.length === 0 ? (
          <div className="flex items-center justify-center rounded-md border border-dashed border-border py-8 text-xs text-muted-foreground">
            No projects yet
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {projects.map((project) => (
              <NavLink
                key={project.id}
                to={`/project/${project.id}`}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors truncate',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{project.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
