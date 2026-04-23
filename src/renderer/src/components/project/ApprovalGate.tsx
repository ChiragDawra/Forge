import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, X, Loader2 } from 'lucide-react'
import type { IntakeDraft, IntakeAnswer } from '../../../../preload/index.d'

interface ApprovalGateProps {
  open: boolean
  draft: IntakeDraft | null
  busy?: boolean
  onCancel: () => void
  /** User approved — forwards their answers to finalise. */
  onApprove: (answers: IntakeAnswer[]) => void | Promise<void>
  /** User wants to edit the original prompt (close + reset). */
  onEdit: () => void
}

/**
 * Modal approval gate for phase boundaries. Shows the model's expanded
 * brief, the clarifying questions with one-line answer inputs, and three
 * exits: Approve, Edit (back to PromptInput), Cancel.
 *
 * Renders to document.body's sibling via fixed positioning — no portal
 * library needed for a single-surface Electron app.
 */
export default function ApprovalGate({
  open,
  draft,
  busy = false,
  onCancel,
  onApprove,
  onEdit
}: ApprovalGateProps): React.JSX.Element | null {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  // Reset answer state whenever a fresh draft arrives so stale answers
  // from a prior run don't leak into the new one.
  useEffect(() => {
    if (draft) {
      setAnswers({})
      setTimeout(() => firstInputRef.current?.focus(), 20)
    }
  }, [draft])

  // Esc cancels — only while modal is open.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, busy, onCancel])

  if (!open || !draft) return null

  const allAnswered = draft.questions.every(
    (q) => (answers[q.id] ?? '').trim().length > 0
  )

  async function handleApprove(): Promise<void> {
    if (!draft) return
    const payload: IntakeAnswer[] = draft.questions.map((q) => ({
      id: q.id,
      answer: (answers[q.id] ?? '').trim()
    }))
    await onApprove(payload)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-gate-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg border border-border bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 id="approval-gate-title" className="text-lg font-semibold">
              Review Intake
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Model: {draft.model} · cost ${draft.costUsd.toFixed(4)}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <section className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expanded brief
            </p>
            <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed">
              {draft.expanded}
            </p>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Clarifying questions
            </p>
            {draft.questions.map((q, i) => (
              <div key={q.id} className="space-y-1">
                <label className="block text-sm font-medium">
                  {i + 1}. {q.question}
                </label>
                {q.why ? (
                  <p className="text-xs text-muted-foreground italic">{q.why}</p>
                ) : null}
                <input
                  ref={i === 0 ? firstInputRef : null}
                  type="text"
                  value={answers[q.id] ?? ''}
                  maxLength={500}
                  placeholder="Your answer…"
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                  disabled={busy}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                />
              </div>
            ))}
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onEdit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit prompt
          </button>
          <button
            onClick={handleApprove}
            disabled={busy || !allAnswered}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Approve & continue
          </button>
        </footer>
      </div>
    </div>
  )
}
