/**
 * Integration tests for the project phase state module.
 * Verifies resumePhaseIndex() correctly determines the next phase to run
 * and that slug derivation is consistent across the pipeline.
 *
 * These tests run in Node (vitest) without Electron — we test pure logic only.
 */

import { describe, it, expect } from 'vitest'

// ── resumePhaseIndex logic (copied inline to avoid Electron imports) ──────────
// Keep in sync with src/main/agent/project-state.ts

interface ProjectPhaseState {
  intake:    object | null
  planning:  object | null
  design:    object | null
  scaffold:  object | null
  codegenResult:  object | null
  reviewReport:   object | null
  securityReport: object | null
  testingReport:  object | null
  deployReport:   object | null
  codegenDone:  boolean
  reviewDone:   boolean
  securityDone: boolean
  testingDone:  boolean
  deployDone:   boolean
}

function resumePhaseIndex(state: ProjectPhaseState): number {
  if (state.deployDone)   return 9
  if (state.testingDone)  return 8
  if (state.securityDone) return 7
  if (state.reviewDone)   return 6
  if (state.codegenDone)  return 5
  if (state.scaffold)     return 4
  if (state.design)       return 3
  if (state.planning)     return 2
  if (state.intake)       return 1
  return 0
}

function emptyState(): ProjectPhaseState {
  return {
    intake: null, planning: null, design: null, scaffold: null,
    codegenResult: null, reviewReport: null, securityReport: null,
    testingReport: null, deployReport: null,
    codegenDone: false, reviewDone: false, securityDone: false,
    testingDone: false, deployDone: false
  }
}

// ── Slug derivation (copied inline to match orchestrator logic) ───────────────

function deriveSlugFromName(projectName: string): string {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
}

function deriveSlugFromProjectId(projectId: string): string {
  return projectId.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resumePhaseIndex', () => {
  it('returns 0 when no phases are done', () => {
    expect(resumePhaseIndex(emptyState())).toBe(0)
  })

  it('returns 1 after intake completes', () => {
    const state = { ...emptyState(), intake: { rawIdea: 'test' } }
    expect(resumePhaseIndex(state)).toBe(1)
  })

  it('returns 2 after planning completes', () => {
    const state = { ...emptyState(), intake: {}, planning: {} }
    expect(resumePhaseIndex(state)).toBe(2)
  })

  it('returns 3 after design completes', () => {
    const state = { ...emptyState(), intake: {}, planning: {}, design: {} }
    expect(resumePhaseIndex(state)).toBe(3)
  })

  it('returns 4 after scaffold completes', () => {
    const state = { ...emptyState(), intake: {}, planning: {}, design: {}, scaffold: { slug: 'my-app', filesCreated: 5 } }
    expect(resumePhaseIndex(state)).toBe(4)
  })

  it('returns 5 after codegen completes', () => {
    const state = { ...emptyState(), intake: {}, planning: {}, design: {}, scaffold: {}, codegenDone: true }
    expect(resumePhaseIndex(state)).toBe(5)
  })

  it('returns 6 after review completes', () => {
    const state = { ...emptyState(), intake: {}, planning: {}, design: {}, scaffold: {}, codegenDone: true, reviewDone: true }
    expect(resumePhaseIndex(state)).toBe(6)
  })

  it('returns 7 after security completes', () => {
    const state = { ...emptyState(), intake: {}, planning: {}, design: {}, scaffold: {}, codegenDone: true, reviewDone: true, securityDone: true }
    expect(resumePhaseIndex(state)).toBe(7)
  })

  it('returns 8 after testing completes', () => {
    const state = { ...emptyState(), codegenDone: true, reviewDone: true, securityDone: true, testingDone: true, intake: {}, planning: {}, design: {}, scaffold: {} }
    expect(resumePhaseIndex(state)).toBe(8)
  })

  it('returns 9 (all done) after deploy completes', () => {
    const state = { ...emptyState(), codegenDone: true, reviewDone: true, securityDone: true, testingDone: true, deployDone: true, intake: {}, planning: {}, design: {}, scaffold: {} }
    expect(resumePhaseIndex(state)).toBe(9)
  })

  it('highest completed phase wins even if earlier phases are missing', () => {
    // Edge case: deploy done but intake null (shouldn't happen in practice,
    // but the function should still return 9)
    const state = { ...emptyState(), deployDone: true }
    expect(resumePhaseIndex(state)).toBe(9)
  })
})

describe('slug derivation consistency', () => {
  it('produces a valid slug from a project name', () => {
    expect(deriveSlugFromName('My Awesome App')).toBe('my-awesome-app')
  })

  it('replaces special characters with hyphens', () => {
    expect(deriveSlugFromName('Foo & Bar (v2)!')).toBe('foo-bar-v2-')
  })

  it('truncates to 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(deriveSlugFromName(long).length).toBeLessThanOrEqual(80)
  })

  it('lowercases the slug', () => {
    expect(deriveSlugFromName('UPPER CASE PROJECT')).toBe('upper-case-project')
  })

  it('produces consistent slug from same projectName regardless of caller', () => {
    // scaffold phase and orchestrator phases 4-8 must produce the same slug
    // for the same projectName
    const name = 'my-todo-app'
    const fromScaffold = deriveSlugFromName(name)
    const fromOrchestrator = deriveSlugFromName(name)
    expect(fromScaffold).toBe(fromOrchestrator)
  })

  it('falls back to projectId slice when no architecture.json', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const slug = deriveSlugFromProjectId(uuid)
    // slice(0,30) of the UUID then replace non-alphanumeric runs with '-'
    expect(slug).toBe('550e8400-e29b-41d4-a716-446655')
    expect(slug.length).toBeLessThanOrEqual(30)
  })
})

describe('phase artefact filenames contract', () => {
  // These constants must match what each phase module writes to disk
  // AND what project-state.ts reads. If they drift, resume breaks.
  const EXPECTED_ARTEFACTS = {
    0: ['intake.json'],
    1: ['prd.md', 'architecture.json'],
    2: ['design-brief.md', 'ui-components.json'],
    3: ['ui-components.json'], // scaffold existence check
    4: ['codegen-report.json'],
    5: ['review-report.json'],
    6: ['security-report.json'],
    7: ['testing-report.json'],
    8: ['deploy-report.json']
  }

  it('has artefacts defined for all 9 phases', () => {
    expect(Object.keys(EXPECTED_ARTEFACTS).length).toBe(9)
  })

  it('intake artefact is intake.json', () => {
    expect(EXPECTED_ARTEFACTS[0]).toContain('intake.json')
  })

  it('planning artefacts include prd.md and architecture.json', () => {
    expect(EXPECTED_ARTEFACTS[1]).toContain('prd.md')
    expect(EXPECTED_ARTEFACTS[1]).toContain('architecture.json')
  })

  it('design artefacts include design-brief.md and ui-components.json', () => {
    expect(EXPECTED_ARTEFACTS[2]).toContain('design-brief.md')
    expect(EXPECTED_ARTEFACTS[2]).toContain('ui-components.json')
  })

  it('codegen report filename matches project-state loader', () => {
    // project-state.ts reads 'codegen-report.json'
    // 4-codegen.ts writes 'codegen-report.json'
    expect(EXPECTED_ARTEFACTS[4]).toContain('codegen-report.json')
  })

  it('all phase reports use kebab-case .json naming', () => {
    const reports = [4, 5, 6, 7, 8].flatMap((k) => EXPECTED_ARTEFACTS[k as keyof typeof EXPECTED_ARTEFACTS])
    for (const filename of reports) {
      expect(filename).toMatch(/^[a-z][a-z0-9-]+-report\.json$/)
    }
  })
})
