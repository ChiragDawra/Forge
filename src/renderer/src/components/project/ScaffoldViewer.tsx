import { useState } from 'react'
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react'
import type { ScaffoldResult } from '../../../../preload/index.d'

interface ScaffoldViewerProps { result: ScaffoldResult }

export default function ScaffoldViewer({ result }: ScaffoldViewerProps): React.JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-border bg-muted/20 px-4 py-2.5 text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-sm font-semibold">Scaffold</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {result.filesCreated} files · {result.model} · ${result.costUsd.toFixed(4)}
        </span>
      </button>
      {open && (
        <div className="p-3 max-h-72 overflow-y-auto font-mono text-xs space-y-0.5">
          {result.tree.map((e, i) => {
            const depth = e.path.split('/').length - 1
            return (
              <div key={i} className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 14}px` }}>
                {e.type === 'dir'
                  ? <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  : <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className={e.type === 'dir' ? 'text-amber-300' : 'text-foreground'}>
                  {e.path.split('/').pop()}
                </span>
                {e.size !== undefined && (
                  <span className="text-muted-foreground/50">{e.size}b</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
