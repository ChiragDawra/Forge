import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { formatCost } from '@renderer/lib/format'

const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/settings': 'Settings',
  '/models': 'Models'
}

export default function Header(): React.JSX.Element {
  const { pathname } = useLocation()
  const [totalCost, setTotalCost] = useState<number>(0)

  useEffect(() => {
    async function fetchCost(): Promise<void> {
      try {
        const cost = await window.api?.ai?.totalCost?.()
        if (typeof cost === 'number') setTotalCost((prev) => (prev === cost ? prev : cost))
      } catch {
        // Not in Electron or no data yet
      }
    }
    fetchCost()
    // Refresh every 30 s
    const interval = setInterval(fetchCost, 30_000)
    return () => clearInterval(interval)
  }, [])

  const title = pathname.startsWith('/project/')
    ? 'Project'
    : pageTitles[pathname] ?? 'Forge'

  const costLabel = formatCost(totalCost)

  return (
    <header className="drag-region flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <h1 className="text-sm font-semibold no-drag">{title}</h1>

      <div className="no-drag flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Activity className="h-3 w-3" />
        <span>{costLabel}</span>
      </div>
    </header>
  )
}
