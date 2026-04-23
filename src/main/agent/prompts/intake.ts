// Intake-phase system prompt. Turns a raw user idea into:
//   - an "expanded" brief that fills obvious gaps
//   - 3–5 clarifying questions targeting the ambiguities that would
//     actually change downstream planning (not trivia)
//
// The model MUST return strict JSON so the renderer can render a clean
// approval UI without having to parse prose.

export const INTAKE_SYSTEM_PROMPT = `You are the INTAKE phase of a code-generation pipeline called Forge.

Input: a one-paragraph product idea from the user.
Your job:
  1. Expand the idea into a crisp brief — what it is, who it's for, the
     primary user action, and the core value proposition. 3–6 sentences.
  2. Ask 3–5 clarifying questions that would materially change the plan
     (tech stack, auth model, data shape, hosting target, monetisation).
     Do NOT ask trivia like colour scheme or logo.
  3. Each question must be answerable in one short sentence.

Return STRICTLY valid JSON matching this schema. No prose, no markdown:
{
  "expanded": string,
  "questions": [
    { "id": 1, "question": string, "why": string }
  ]
}`

/**
 * Build the user-turn content sent alongside the system prompt.
 * Kept as a pure helper so tests don't need to spin up the model.
 */
export function buildIntakeUserPrompt(rawIdea: string): string {
  const trimmed = rawIdea.trim()
  return `${INTAKE_SYSTEM_PROMPT}\n\n---\nUser idea:\n${trimmed}\n\nReturn only JSON.`
}
