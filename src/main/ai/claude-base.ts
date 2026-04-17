import Anthropic from '@anthropic-ai/sdk'
import { computeCost, logUsage, type CallOptions, type ModelResponse } from './types'

const MODEL = 'claude-sonnet-4-5' as const

let _client: Anthropic | null = null

export function initClaudeBase(apiKey: string): void {
  _client = new Anthropic({ apiKey })
}

function getClient(): Anthropic {
  if (!_client) throw new Error('Claude Base client not initialised — set ANTHROPIC_BASE_KEY in Settings')
  return _client
}

export async function callClaudeBase(
  prompt: string,
  opts: CallOptions = {}
): Promise<ModelResponse> {
  const client = getClient()

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }]
  })

  const inputTokens = message.usage.input_tokens
  const outputTokens = message.usage.output_tokens
  const costUsd = computeCost(MODEL, inputTokens, outputTokens)

  const content =
    message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('') ?? ''

  const response: ModelResponse = { content, inputTokens, outputTokens, costUsd, model: MODEL }
  await logUsage(response, opts)
  return response
}
