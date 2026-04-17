import { callClaudeBase } from './claude-base'
import { callClaudeOpus } from './claude-opus'
import { callGemini } from './gemini'
import type { CallOptions, ModelResponse } from './types'

/**
 * Task types map to specific models:
 *  - 'intake'    → Gemini Flash  (fast, cheap — parse user prompt)
 *  - 'planning'  → Claude Base   (structured reasoning)
 *  - 'codegen'   → Claude Base   (primary code generation)
 *  - 'review'    → Claude Base   (code review)
 *  - 'security'  → Claude Opus   (deep security analysis — highest quality)
 *  - 'testing'   → Claude Base   (test generation)
 *  - 'deploy'    → Gemini Flash  (deployment config — fast)
 *  - 'generic'   → Claude Base   (default fallback)
 */
export type TaskType =
  | 'intake'
  | 'planning'
  | 'codegen'
  | 'review'
  | 'security'
  | 'testing'
  | 'deploy'
  | 'generic'

export async function routeTask(
  taskType: TaskType,
  prompt: string,
  opts: CallOptions = {}
): Promise<ModelResponse> {
  switch (taskType) {
    case 'intake':
    case 'deploy':
      return callGemini(prompt, opts)

    case 'security':
      return callClaudeOpus(prompt, opts)

    case 'planning':
    case 'codegen':
    case 'review':
    case 'testing':
    case 'generic':
    default:
      return callClaudeBase(prompt, opts)
  }
}
