// Architecture prompt for the planning phase.
// Fed to Claude Base (structured reasoning) because it needs to produce
// well-constrained JSON that downstream code-gen phases will rely on.

export const ARCHITECTURE_SYSTEM_PROMPT = `You are a software architect designing the technical foundation for a new application.

Input: an expanded product brief + answered clarifications + a PRD.

Return STRICTLY valid JSON matching this schema. No prose, no markdown:
{
  "stack": {
    "frontend": string,
    "backend": string,
    "database": string,
    "auth": string,
    "hosting": string,
    "other": string[]
  },
  "folderTree": [
    { "path": string, "description": string }
  ],
  "keyDecisions": [
    { "decision": string, "rationale": string }
  ],
  "phases": [
    { "name": string, "description": string, "order": number }
  ]
}

Rules:
- stack fields: be specific (e.g. "React 18 + Vite", "Express + tRPC", "PostgreSQL 16").
- folderTree: list every top-level folder and the most important sub-paths. 8–20 entries.
- keyDecisions: 3–6 entries. Name the alternative that was rejected.
- phases: the build plan broken into 4–8 named phases, in execution order.
- Return only JSON.`

export function buildArchitectureUserPrompt(
  intakeJson: { expanded: string; clarifications: { question: string; answer: string }[] },
  prd: string
): string {
  const clarBlock = intakeJson.clarifications
    .filter((c) => c.answer.trim())
    .map((c) => `Q: ${c.question}\nA: ${c.answer}`)
    .join('\n\n')

  return `${ARCHITECTURE_SYSTEM_PROMPT}\n\n---\nExpanded brief:\n${intakeJson.expanded}\n\nClarifications:\n${clarBlock || '(none)'}\n\nPRD summary (first 2000 chars):\n${prd.slice(0, 2000)}\n\nReturn only JSON.`
}
