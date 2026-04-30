// Codegen phase prompts.
// The system prompt instructs the model to write complete, production-quality
// TypeScript/React code for a single file at a time.

export const CODEGEN_SYSTEM_PROMPT = `You are an expert full-stack TypeScript developer writing production code for an Electron + React + Vite application.

Rules:
- Output ONLY the complete file content — no prose, no markdown fences, no explanations.
- Write clean, typed TypeScript. Use React 18 functional components with hooks.
- Follow the design tokens and component patterns from the design brief.
- Import only from packages that exist in the project's package.json or from relative paths.
- Use Tailwind CSS utility classes for styling (no CSS modules, no styled-components).
- Handle loading and error states explicitly.
- For IPC calls, use window.api.* (already bridged through the preload).
- Export a default export for React components.
- Include proper TypeScript types for all props and state.
- Do NOT add test files, stories, or documentation blocks.`

export const CODEGEN_TASK_SYSTEM_PROMPT = `You are planning the implementation tasks for a codegen phase.

Given the project context, output a JSON array of files to implement in priority order.
Each entry: { "path": string, "description": string, "priority": "high"|"medium"|"low", "taskType": "component"|"page"|"hook"|"util"|"ipc"|"config" }

Rules:
- path is relative to the project scaffold root
- Focus on the highest-value files that deliver the core user flows
- Maximum 20 files per batch
- Return ONLY the JSON array`

/**
 * Build the user-turn prompt for implementing a single file.
 */
export function buildCodegenFilePrompt(
  filePath: string,
  description: string,
  contextBlock: string
): string {
  return `${CODEGEN_SYSTEM_PROMPT}

---

## Project Context

${contextBlock}

---

## Task

Implement the file: \`${filePath}\`
Purpose: ${description}

Write the complete, final content for this file.`
}

/**
 * Build the prompt for planning which files to implement.
 */
export function buildCodegenPlanPrompt(contextBlock: string, alreadyDone: string[]): string {
  const doneBlock = alreadyDone.length
    ? `\nAlready implemented (skip these):\n${alreadyDone.map((p) => `- ${p}`).join('\n')}`
    : ''

  return `${CODEGEN_TASK_SYSTEM_PROMPT}

---

## Project Context

${contextBlock}
${doneBlock}

Output the JSON array of files to implement next (max 20).`
}
