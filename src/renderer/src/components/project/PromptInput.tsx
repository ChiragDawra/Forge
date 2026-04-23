import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

interface PromptInputProps {
  /** Called with the trimmed prompt when user submits. */
  onSubmit: (prompt: string) => void | Promise<void>
  /** Disable submit while a phase is in flight. */
  busy?: boolean
  /** Starting value (for editing an existing intake prompt). */
  initial?: string
  /** Max characters — keep in sync with IPC side (10_000). */
  maxLength?: number
  placeholder?: string
}

/**
 * Large-format textarea + submit button. Enforces trim + length limits
 * on the client so the user sees friction before an IPC roundtrip.
 */
export default function PromptInput({
  onSubmit,
  busy = false,
  initial = '',
  maxLength = 10_000,
  placeholder = 'Build me a SaaS dashboard for tracking freelance projects, with auth, payments, and a kanban board…'
}: PromptInputProps): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const trimmed = value.trim()
  const tooShort = trimmed.length < 20
  const atCap = value.length >= maxLength

  async function handle(): Promise<void> {
    if (busy || !trimmed || tooShort) return
    await onSubmit(trimmed)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Describe your app</label>
        <span
          className={`text-xs tabular-nums ${
            atCap ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {value.length.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
      </div>

      <textarea
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="min-h-[180px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {tooShort
            ? 'Add a little more detail (at least 20 chars) to get useful questions back.'
            : 'Forge will expand this and ask 3–5 clarifying questions before planning.'}
        </p>
        <button
          onClick={handle}
          disabled={busy || tooShort}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Run Intake
        </button>
      </div>
    </div>
  )
}
