import { KeyRound } from 'lucide-react'
import { API_KEYS } from '@renderer/lib/constants'

const keyEntries = Object.entries(API_KEYS) as [string, string][]

export default function Settings(): React.JSX.Element {
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
            <input
              type="password"
              placeholder={keyName}
              disabled
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground opacity-60"
            />
          </div>
        ))}
      </div>

      <button
        disabled
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
      >
        Save Keys (Day 3)
      </button>
    </div>
  )
}
