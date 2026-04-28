import { useState } from 'react'
import { ChevronDown, ChevronRight, Server, FolderTree, GitFork, List } from 'lucide-react'
import type { PlanningResult, ArchFolderEntry, ArchDecision, ArchPhase } from '../../../../preload/index.d'

interface PlanViewerProps {
  result: PlanningResult
}

/**
 * Renders the Phase 1 planning output:
 *   - PRD (markdown rendered as formatted text, tab-selectable)
 *   - Architecture: stack table, folder tree, key decisions, build phases
 */
export default function PlanViewer({ result }: PlanViewerProps): React.JSX.Element {
  const [tab, setTab] = useState<'prd' | 'arch'>('prd')

  return (
    <div className="space-y-3">
      {/* Cost badge */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['prd', 'arch'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t === 'prd' ? 'PRD' : 'Architecture'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          ${result.totalCostUsd.toFixed(4)} · {result.prdModel} + {result.archModel}
        </span>
      </div>

      {tab === 'prd' ? (
        <PrdPanel prd={result.prd} />
      ) : (
        <ArchPanel arch={result.architecture} />
      )}
    </div>
  )
}

// ── PRD panel ─────────────────────────────────────────────────────────

function PrdPanel({ prd }: { prd: string }): React.JSX.Element {
  // Split on markdown H2 headings and render each section collapsible.
  const sections = prd
    .split(/^##\s+/m)
    .filter(Boolean)
    .map((block) => {
      const nl = block.indexOf('\n')
      const heading = nl === -1 ? block.trim() : block.slice(0, nl).trim()
      const body = nl === -1 ? '' : block.slice(nl + 1).trim()
      return { heading, body }
    })

  if (sections.length === 0) {
    return (
      <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm">
        {prd}
      </pre>
    )
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
      {sections.map((s) => (
        <CollapsibleSection key={s.heading} heading={s.heading} body={s.body} />
      ))}
    </div>
  )
}

function CollapsibleSection({
  heading,
  body
}: {
  heading: string
  body: string
}): React.JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-muted/20 px-4 py-2.5 text-left text-sm font-semibold hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {heading}
      </button>
      {open && body && (
        <div className="px-4 py-3">
          <PrdBody text={body} />
        </div>
      )}
    </div>
  )
}

/** Minimal markdown: bullet lists and numbered lists, plain text otherwise. */
function PrdBody({ text }: { text: string }): React.JSX.Element {
  const lines = text.split('\n')
  return (
    <ul className="space-y-1 text-sm text-foreground">
      {lines
        .filter((l) => l.trim())
        .map((line, i) => {
          const bullet = line.match(/^[-*]\s+(.+)/)
          const numbered = line.match(/^\d+\.\s+(.+)/)
          const content = bullet?.[1] ?? numbered?.[1] ?? line.trim()
          return (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{content}</span>
            </li>
          )
        })}
    </ul>
  )
}

// ── Architecture panel ────────────────────────────────────────────────

function ArchPanel({
  arch
}: {
  arch: PlanningResult['architecture']
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Stack */}
      <Section icon={<Server className="h-4 w-4" />} title="Tech Stack">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {Object.entries(arch.stack)
            .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v))
            .map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k}
                </span>
                <span className="text-foreground">
                  {Array.isArray(v) ? v.join(', ') : (v as string)}
                </span>
              </div>
            ))}
        </div>
      </Section>

      {/* Folder tree */}
      {arch.folderTree.length > 0 && (
        <Section icon={<FolderTree className="h-4 w-4" />} title="Folder Structure">
          <FolderTreeView entries={arch.folderTree} />
        </Section>
      )}

      {/* Key decisions */}
      {arch.keyDecisions.length > 0 && (
        <Section icon={<GitFork className="h-4 w-4" />} title="Key Decisions">
          <div className="space-y-2">
            {arch.keyDecisions.map((d, i) => (
              <DecisionRow key={i} decision={d} />
            ))}
          </div>
        </Section>
      )}

      {/* Build phases */}
      {arch.phases.length > 0 && (
        <Section icon={<List className="h-4 w-4" />} title="Build Phases">
          <ol className="space-y-1.5">
            {arch.phases.map((p) => (
              <PhaseRow key={p.order} phase={p} />
            ))}
          </ol>
        </Section>
      )}
    </div>
  )
}

function Section({
  icon,
  title,
  children
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function FolderTreeView({ entries }: { entries: ArchFolderEntry[] }): React.JSX.Element {
  return (
    <div className="font-mono text-xs space-y-0.5">
      {entries.map((e, i) => {
        const depth = e.path.split('/').length - 1
        return (
          <div key={i} className="flex gap-2" style={{ paddingLeft: `${depth * 12}px` }}>
            <span className="shrink-0 text-primary/70">
              {depth === 0 ? '📁' : '└─'}
            </span>
            <span className="text-foreground">{e.path.split('/').pop()}</span>
            {e.description && (
              <span className="text-muted-foreground truncate">— {e.description}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DecisionRow({ decision }: { decision: ArchDecision }): React.JSX.Element {
  return (
    <div className="rounded border border-border bg-muted/10 px-3 py-2 text-sm">
      <p className="font-medium">{decision.decision}</p>
      {decision.rationale && (
        <p className="mt-0.5 text-xs text-muted-foreground">{decision.rationale}</p>
      )}
    </div>
  )
}

function PhaseRow({ phase }: { phase: ArchPhase }): React.JSX.Element {
  return (
    <li className="flex gap-3 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {phase.order}
      </span>
      <div>
        <span className="font-medium">{phase.name}</span>
        {phase.description && (
          <p className="text-xs text-muted-foreground">{phase.description}</p>
        )}
      </div>
    </li>
  )
}
