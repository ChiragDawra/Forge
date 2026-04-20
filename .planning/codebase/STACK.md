# Technology Stack

**Analysis Date:** 2026-04-20

## Languages

**Primary:**
- TypeScript 5.7.3 - All source code (main process, preload, renderer)

**Supporting:**
- JavaScript - Configuration files (PostCSS, PostCSS plugins)

## Runtime

**Environment:**
- Node.js 22.13.9 (inferred from @types/node)
- Electron 33.4.11 - Desktop application framework with multi-process architecture

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` present

## Frameworks

**Core Desktop:**
- Electron 33.4.11 - Desktop application framework
- electron-vite 3.0.0 - Build tool and dev server for Electron
- @electron-toolkit/utils 3.0.0 - Electron utilities and optimization helpers
- @electron-toolkit/preload 3.0.1 - Preload script utilities
- @electron-toolkit/tsconfig 2.0.0 - TypeScript configuration preset

**Frontend:**
- React 18.3.1 - UI library
- react-router-dom 7.3.0 - Client-side routing
- @vitejs/plugin-react 4.3.4 - Vite React plugin for HMR and fast refresh

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- PostCSS 8.5.3 - CSS transformation pipeline
- autoprefixer 10.4.20 - Browser vendor prefixes
- tailwind-merge 3.5.0 - Merge Tailwind classes without conflicts
- clsx 2.1.1 - Conditional class name utility

**Database:**
- better-sqlite3 12.8.0 - Synchronous SQLite3 client
- drizzle-orm 0.41.0 - TypeScript ORM for type-safe queries
- drizzle-kit 0.30.4 - Schema management and migrations (dev-only)

**State Management:**
- zustand 5.0.3 - Lightweight state management library

**Data Fetching:**
- @tanstack/react-query 5.67.3 - Server state management and caching

**Icons:**
- lucide-react 0.475.0 - Icon library component library

**Process Management:**
- execa 9.5.2 - Execute external processes with streaming support
- ws 8.18.1 - WebSocket implementation (may be used for process communication)

**Credential Storage:**
- keytar 7.9.0 - OS-level credential storage (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- electron-store 8.2.0 - Persistent app configuration storage

**AI Integrations:**
- @anthropic-ai/sdk 0.51.0 - Anthropic Claude API client
- @google/generative-ai 0.24.0 - Google Gemini API client

## Key Dependencies

**Critical:**
- better-sqlite3 - Local database for project and usage tracking; no external service dependency
- drizzle-orm - Type-safe SQL generation and migrations; schema at `src/main/db/schema.ts`
- keytar - Secure credential storage preventing plaintext secrets in config files

**Infrastructure:**
- Electron - Complete desktop app framework with sandboxed renderer process
- @anthropic-ai/sdk - Claude model API calls with token counting and cost tracking
- @google/generative-ai - Gemini Flash model API calls with usage tracking
- execa - Execute shell commands (likely for code generation and deployment workflows)

## Configuration

**Environment:**
- `ANTHROPIC_BASE_KEY` - Stored in OS keychain, initializes Claude Sonnet 4.5 client
- `ANTHROPIC_OPUS_KEY` - Stored in OS keychain, initializes Claude Opus 4 client
- `GEMINI_API_KEY` - Stored in OS keychain, initializes Gemini 2.0 Flash client
- `VERCEL_TOKEN` - Stored in OS keychain (optional, for deployments)
- `GITHUB_TOKEN` - Stored in OS keychain (optional, for code generation workflows)
- Development DB: `.local/forge-dev.db` (Drizzle Kit override: `FORGE_DB_URL`)

**Build:**
- `electron.vite.config.ts` - Electron/Vite build configuration with path aliases
- `tsconfig.json` - Root TypeScript config with references to web/node variants
- `tsconfig.web.json` - Renderer (browser) TypeScript configuration
- `tsconfig.node.json` - Main process TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration with CSS variables support
- `drizzle.config.ts` - Drizzle ORM schema and migration configuration
- `postcss.config.js` - PostCSS with Tailwind and autoprefixer

## Platform Requirements

**Development:**
- macOS, Linux, or Windows (cross-platform Electron app)
- Node.js 22.x
- SQLite 3.x (included with better-sqlite3)
- OS keychain/credential manager (system-provided)

**Production:**
- macOS - DMG installer (from `resources/icon.png`)
- Windows - NSIS installer
- Packaged via electron-builder 25.1.8 → `dist/` directory

---

*Stack analysis: 2026-04-20*
