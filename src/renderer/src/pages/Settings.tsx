import { useEffect, useState } from 'react'
import { KeyRound, Save, Trash2, Loader2, Check } from 'lucide-react'
import { API_KEYS } from '@renderer/lib/constants'

const keyEntries = Object.entries(API_KEYS) as [string, string][]

export default function Settings(): React.JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    async function loadKeys(): Promise<void> {
      const loaded: Record<string, string> = {}
      for (const [, keyName] of keyEntries) {
        const val = await window.api.settings.get(keyName)
        if (val) loaded[keyName] = val
      }
      setValues(loaded)
      setLoading(false)
    }
    loadKeys()
  }, [])

  async function handleSave(): Promise<void> {
    setSaving(true)
    setFeedback(null)
    try {
      for (const [, keyName] of keyEntries) {
        const val = values[keyName]
        if (val && val.trim()) {
          await window.api.settings.set(keyName, val.trim())
        }
      }
      setFeedback('Keys saved to keychain')
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear(keyName: string): Promise<void> {
    await window.api.settings.delete(keyName)
    setValues((prev) => {
      const next = { ...prev }
      delete next[keyName]
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          API keys are stored securely in your OS keychain.
        </p>
      </div>

      <div className="space-y-4">
        {keyEntries.map(([label, keyName]) => (
          <div key={keyName} className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              {label.replace(/_/g, ' ')}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={keyName}
                value={values[keyName] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [keyName]: e.target.value }))
                }
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {values[keyName] && (
                <button
                  onClick={() => handleClear(keyName)}
                  title="Remove key"
                  className="rounded-md border border-input px-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Keys
        </button>
        {feedback && (
          <span
            className={`flex items-center gap-1 text-sm ${feedback.startsWith('Error') ? 'text-destructive' : 'text-green-400'}`}
          >
            {!feedback.startsWith('Error') && <Check className="h-3.5 w-3.5" />}
            {feedback}
          </span>
        )}
      </div>
    </div>
  )
}
