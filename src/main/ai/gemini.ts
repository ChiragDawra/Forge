import { GoogleGenerativeAI } from '@google/generative-ai'
import { computeCost, logUsage, type CallOptions, type ModelResponse } from './types'

const MODEL = 'gemini-2.0-flash' as const

let _client: GoogleGenerativeAI | null = null

export function initGemini(apiKey: string): void {
  _client = new GoogleGenerativeAI(apiKey)
}

function getClient(): GoogleGenerativeAI {
  if (!_client) throw new Error('Gemini client not initialised — set GEMINI_API_KEY in Settings')
  return _client
}

export async function callGemini(
  prompt: string,
  opts: CallOptions = {}
): Promise<ModelResponse> {
  const client = getClient()
  const model = client.getGenerativeModel({ model: MODEL })

  const result = await model.generateContent(prompt)
  const response = result.response

  const inputTokens = response.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0
  const costUsd = computeCost(MODEL, inputTokens, outputTokens)
  const content = response.text()

  const modelResponse: ModelResponse = {
    content,
    inputTokens,
    outputTokens,
    costUsd,
    model: MODEL
  }
  await logUsage(modelResponse, opts)
  return modelResponse
}
