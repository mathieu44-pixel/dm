import Anthropic from '@anthropic-ai/sdk'
import { costUsd, isModelId, MODEL_LIST } from './models'
import type { LlmProvider, LlmRequest, LlmResult, LlmUsage } from './types'

/**
 * Fournisseur Anthropic (Claude), via le SDK officiel utilisé dans le navigateur.
 * `dangerouslyAllowBrowser` est volontaire : application personnelle, clé saisie par
 * l'utilisateur et stockée uniquement sur son appareil (jamais dans le code).
 */

function toUsage(usage: Anthropic.Usage): LlmUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  }
}

function priceOf(model: string, usage: Anthropic.Usage): number {
  return isModelId(model) ? costUsd(model, usage) : 0
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

function params(request: LlmRequest) {
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    ...(request.system ? { system: request.system } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
  }
}

export function createAnthropicProvider(apiKey: string): LlmProvider {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })

  async function complete(request: LlmRequest): Promise<LlmResult> {
    const message = await client.messages.create(params(request), { signal: request.signal })
    return { text: textOf(message), usage: toUsage(message.usage), costUsd: priceOf(request.model, message.usage) }
  }

  async function stream(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult> {
    const runner = client.messages.stream(params(request), { signal: request.signal })
    runner.on('text', (delta) => onText(delta))
    const message = await runner.finalMessage()
    return { text: textOf(message), usage: toUsage(message.usage), costUsd: priceOf(request.model, message.usage) }
  }

  async function listModels() {
    return MODEL_LIST.map((m) => ({ id: m.id, label: m.label, hint: m.hint }))
  }

  return { id: 'anthropic', complete, stream, listModels }
}
