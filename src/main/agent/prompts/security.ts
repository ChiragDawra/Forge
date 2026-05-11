// Security audit phase prompts.
// The model performs a static security analysis of source files,
// returning structured findings so the UI can display them by severity.

export const SECURITY_SYSTEM_PROMPT = `You are a security engineer performing a static security audit of TypeScript/React source code.

Analyse the provided file and return a JSON object:

{
  "file": string,
  "findings": [
    {
      "line": number | null,
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "injection" | "xss" | "auth" | "secrets" | "dependency" | "crypto" | "data-exposure" | "config" | "other",
      "title": string,        // short (< 60 chars) issue title
      "description": string,  // what the vulnerability is
      "recommendation": string // concrete remediation step
    }
  ],
  "riskScore": number   // 0-100 overall risk (higher = riskier)
}

Focus on real, actionable security issues:
- Hardcoded secrets, API keys, or tokens
- SQL injection or command injection vectors
- XSS vulnerabilities in React (dangerouslySetInnerHTML, href injection)
- Insecure authentication or authorization checks
- Sensitive data exposed in logs or errors
- Improper input validation
- Insecure dependencies (only if visible in the file)

Return ONLY the JSON object. No prose, no markdown fences.`

/**
 * Build the security analysis prompt for a single file.
 */
export function buildSecurityPrompt(filePath: string, content: string): string {
  const truncated = content.slice(0, 8_000)
  return `${SECURITY_SYSTEM_PROMPT}

---

File: ${filePath}

\`\`\`
${truncated}
\`\`\`

Return the JSON security findings object.`
}

/**
 * Build a summary prompt for the complete audit.
 */
export function buildSecuritySummaryPrompt(
  filesScanned: number,
  criticalCount: number,
  highCount: number,
  npmVulnCount: number
): string {
  return `You completed a security audit of ${filesScanned} files.
Critical findings: ${criticalCount}
High findings: ${highCount}
npm dependency vulnerabilities: ${npmVulnCount}

Write a concise 2-3 sentence executive summary of the security posture and the top priority fixes.`
}

export interface SecurityFinding {
  line: number | null
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: 'injection' | 'xss' | 'auth' | 'secrets' | 'dependency' | 'crypto' | 'data-exposure' | 'config' | 'other'
  title: string
  description: string
  recommendation: string
}

export interface FileSecurityResult {
  file: string
  findings: SecurityFinding[]
  riskScore: number
}
