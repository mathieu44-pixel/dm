import { createAnthropicProvider } from './anthropic'
import { describeLlmError } from './errors'
import { createGeminiProvider } from './gemini'
import type { LlmProvider, ProviderId } from './types'

export function createProvider(provider: ProviderId, apiKey: string): LlmProvider {
  return provider === 'gemini' ? createGeminiProvider(apiKey) : createAnthropicProvider(apiKey)
}

export const PROVIDER_LABELS: Record<ProviderId, { name: string; hint: string; keyUrl: string; keyPrefix?: string }> = {
  gemini: {
    name: 'Google Gemini',
    hint: 'Gratuit (offre Google AI Studio), idéal pour les tests',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
  },
  anthropic: {
    name: 'Anthropic Claude',
    hint: 'Payant à l\'usage, meilleure qualité d\'écriture',
    keyUrl: 'https://platform.claude.com/settings/keys',
    keyPrefix: 'sk-ant-',
  },
}

export type ConnectionTestResult =
  | { ok: true; model: string; latencyMs: number; costUsd: number; reply: string }
  | { ok: false; model: string; error: string }

/** Envoie une requête minuscule pour vérifier la clé et l'accès au modèle. */
export async function testConnection(provider: ProviderId, apiKey: string, model: string): Promise<ConnectionTestResult> {
  const started = performance.now()
  try {
    const result = await createProvider(provider, apiKey).complete({
      model,
      // Marge suffisante pour les modèles qui « réfléchissent » avant de répondre.
      maxTokens: 256,
      messages: [{ role: 'user', content: 'Réponds uniquement : OK' }],
    })
    return {
      ok: true,
      model,
      latencyMs: Math.round(performance.now() - started),
      costUsd: result.costUsd,
      reply: result.text.trim().slice(0, 40),
    }
  } catch (error) {
    return { ok: false, model, error: describeLlmError(error) }
  }
}
