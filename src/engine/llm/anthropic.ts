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

/** Encadre le contexte variable quand il est déplacé dans le dernier message (cache de l'historique). */
export const DYNAMIC_CONTEXT_OPEN = '<contexte_de_la_partie>\n(Informations de la narratrice, pas écrites par le joueur.)'
export const DYNAMIC_CONTEXT_CLOSE = '</contexte_de_la_partie>'

type ContentBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }

const imageBlocks = (m: { images?: { mime: string; data: string }[] }): ContentBlock[] =>
  (m.images ?? []).map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: img.data },
  }))

/**
 * Requête Anthropic. Avec `cacheHistory`, le contexte variable (mémoire, jauges, lore) quitte le prompt
 * système pour le début du dernier message : le préfixe « consignes + historique » reste identique d'un tour
 * à l'autre et peut être relu depuis le cache (environ 10 fois moins cher). Le point de cache est posé sur
 * l'avant-dernier message, qui ne change plus au tour suivant.
 */
export function buildAnthropicParams(request: LlmRequest) {
  const last = request.messages[request.messages.length - 1]
  const moveDynamic = !!request.cacheHistory && request.messages.length >= 2 && last?.role === 'user'
  const dynamicInSystem = moveDynamic ? undefined : request.systemDynamic
  const messages = request.messages.map((m, i): { role: 'user' | 'assistant'; content: string | ContentBlock[] } => {
    const isLast = i === request.messages.length - 1
    if (moveDynamic && i === request.messages.length - 2)
      return { role: m.role, content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] }
    if (moveDynamic && isLast && request.systemDynamic?.trim())
      return {
        role: m.role,
        content: [
          { type: 'text', text: `${DYNAMIC_CONTEXT_OPEN}\n${request.systemDynamic.trim()}\n${DYNAMIC_CONTEXT_CLOSE}` },
          { type: 'text', text: m.content },
        ],
      }
    if (m.images?.length) return { role: m.role, content: [...imageBlocks(m), { type: 'text', text: m.content }] }
    return { role: m.role, content: m.content }
  })
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    ...(request.system || dynamicInSystem
      ? {
          system: [
            ...(request.system
              ? [
                  {
                    type: 'text' as const,
                    text: request.system,
                    ...(request.cacheSystem ? { cache_control: { type: 'ephemeral' as const } } : {}),
                  },
                ]
              : []),
            ...(dynamicInSystem ? [{ type: 'text' as const, text: dynamicInSystem }] : []),
          ],
        }
      : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    messages,
  }
}

export function createAnthropicProvider(apiKey: string): LlmProvider {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })

  async function complete(request: LlmRequest): Promise<LlmResult> {
    const message = await client.messages.create(buildAnthropicParams(request), { signal: request.signal })
    return { text: textOf(message), usage: toUsage(message.usage), costUsd: priceOf(request.model, message.usage), truncated: message.stop_reason === 'max_tokens' }
  }

  async function stream(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult> {
    const runner = client.messages.stream(buildAnthropicParams(request), { signal: request.signal })
    runner.on('text', (delta) => onText(delta))
    const message = await runner.finalMessage()
    return { text: textOf(message), usage: toUsage(message.usage), costUsd: priceOf(request.model, message.usage), truncated: message.stop_reason === 'max_tokens' }
  }

  async function listModels() {
    return MODEL_LIST.map((m) => ({ id: m.id, label: m.label, hint: m.hint }))
  }

  return { id: 'anthropic', complete, stream, listModels }
}
