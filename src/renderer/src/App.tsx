import React from 'react'

// Routing and layout wired up in Day 2
function App(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Forge</h1>
        <p className="text-muted-foreground text-lg">
          AI Full-Stack App Builder
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Day 1 — Foundation complete
        </div>
      </div>
    </div>
  )
}

export default App
