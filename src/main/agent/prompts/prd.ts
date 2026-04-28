// PRD prompt for the planning phase.
// Fed to Gemini (long-context, cheap) because PRDs are long-form prose
// that don't require deep reasoning — just structured writing.

export const PRD_SYSTEM_PROMPT = `You are a senior product manager writing a concise PRD for a software project.

Input: an intake JSON object with an expanded brief and answered clarifications.

Your output is a PRD with these exact sections (use these headings verbatim):
## Overview
## Problem
## Goals
## Non-Goals
## User Stories
## Functional Requirements
## Non-Functional Requirements
## Out of Scope

Rules:
- Under each heading, write 3–8 bullet points. No filler.
- User Stories format: "As a <user>, I want <action> so that <outcome>."
- Functional Requirements: numbered, imperative ("The system shall …").
- Non-Functional Requirements: include performance, security, accessibility minimums.
- Out of Scope: be explicit — name what the v1 deliberately excludes.
- No preamble, no postamble. Start with "## Overview".`

export function buildPrdUserPrompt(intakeJson: {
  expanded: string
  clarifications: { question: string; answer: string }[]
}): string {
  const clarBlock = intakeJson.clarifications
    .filter((c) => c.answer.trim())
    .map((c) => `Q: ${c.question}\nA: ${c.answer}`)
    .join('\n\n')

  return `${PRD_SYSTEM_PROMPT}\n\n---\nExpanded brief:\n${intakeJson.expanded}\n\nClarifications:\n${clarBlock || '(none)'}\n\nWrite the PRD now.`
}
