// Code review phase prompts.
// Produces structured JSON findings so the UI can render a diff-like view.

export const REVIEW_SYSTEM_PROMPT = `You are a senior software engineer performing a thorough code review.

Analyse the provided source file and return a JSON object with the following shape:

{
  "file": string,          // relative path reviewed
  "summary": string,       // 1-2 sentence overall assessment
  "findings": [
    {
      "line": number | null,       // line number (null if file-level)
      "severity": "error" | "warning" | "info",
      "category": "bug" | "security" | "performance" | "style" | "maintainability",
      "message": string,           // concise description of the issue
      "suggestion": string         // concrete fix or improvement
    }
  ],
  "score": number          // 0-100 quality score
}

Rules:
- Be precise and actionable — vague findings are not useful.
- Report real issues only. Do not invent problems.
- For security findings always include the exact line reference.
- Return ONLY the JSON object. No prose, no markdown fences.`

/**
 * Build the user-turn prompt for reviewing a single file.
 */
export function buildReviewPrompt(filePath: string, content: string): string {
  const truncated = content.slice(0, 8_000)
  return `${REVIEW_SYSTEM_PROMPT}

---

File: ${filePath}

\`\`\`
${truncated}
\`\`\`

Return the JSON review object.`
}

/**
 * Build a batch-summary prompt after all file reviews are complete.
 */
export function buildReviewSummaryPrompt(fileCount: number, findings: ReviewFinding[]): string {
  const errorCount   = findings.filter((f) => f.severity === 'error').length
  const warningCount = findings.filter((f) => f.severity === 'warning').length
  const topFindings  = findings
    .filter((f) => f.severity === 'error' || f.severity === 'warning')
    .slice(0, 10)
    .map((f) => `- [${f.severity.toUpperCase()}] ${f.message}`)
    .join('\n')

  return `You reviewed ${fileCount} files and found ${errorCount} errors, ${warningCount} warnings.

Top findings:
${topFindings || '(none)'}

Write a 2-3 sentence summary of the overall code quality and the most important issues to fix.`
}

export interface ReviewFinding {
  line: number | null
  severity: 'error' | 'warning' | 'info'
  category: 'bug' | 'security' | 'performance' | 'style' | 'maintainability'
  message: string
  suggestion: string
}

export interface FileReview {
  file: string
  summary: string
  findings: ReviewFinding[]
  score: number
}
