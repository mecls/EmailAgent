import OpenAI from 'openai'
import { env } from '@/lib/env'

let cached: OpenAI | null = null

/**
 * Shared OpenAI-compatible client (Ollama Cloud) for the agent loop + brief
 * composition. Points at LLM_BASE_URL with LLM_API_KEY. maxRetries: 0 — the
 * agent loop / Inngest layer own retry behavior, and we don't want hidden retries
 * mid-stream.
 */
export function openai(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: env.llmApiKey(),
      baseURL: env.llmBaseUrl(),
      maxRetries: 0,
    })
  }
  return cached
}

export function llmModel(): string {
  return env.llmModel()
}

export function llmMaxTokens(): number {
  return env.llmMaxTokens()
}
