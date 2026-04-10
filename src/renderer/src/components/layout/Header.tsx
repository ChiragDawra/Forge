import { useLocation } from 'react-router-dom'
import { Activity } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/settings': 'Settings',
  '/models': 'Models'
}

export default function Header(): React.JSX.Element {
  const { pathname } = useLocation()

  const title = pathname.startsWith('/project/')
    ? 'Project'
    : pageTitles[pathname] ?? 'Forge'

  return (
    <header className="drag-region flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <h1 className="text-sm font-semibold no-drag">{title}</h1>

      {/* Model usage indicator placeholder */}
      <div className="no-drag flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Activity className="h-3 w-3" />
        <span>$0.00</span>
      </div>
    </header>
  )
}
