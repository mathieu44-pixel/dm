import Anthropic from '@anthropic-ai/sdk'
import { describeLlmError } from './errors'
import { costUsd, type ModelId } from './models'

/**
 * Client Anthropic utilisé directement depuis le navigateur.
 * `dangerouslyAllowBrowser` est volontaire : application personnelle, clé saisie par
 * l'utilisateur et stockée uniquement sur son appareil (jamais dans le code).
 */
export function createClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })
}

export type ConnectionTestResult =
  | { ok: true; model: ModelId; latencyMs: number; costUsd: number }
  | { ok: false; model: ModelId; error: string }

/** Envoie une requête minuscule pour vérifier la clé et l'accès au modèle (coût : une fraction de centime). */
export async function testConnection(apiKey: string, model: ModelId): Promise<ConnectionTestResult> {
  const started = performance.now()
  try {
    const response = await createClient(apiKey).messages.create({
      model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Réponds uniquement : OK' }],
    })
    return {
      ok: true,
      model,
      latencyMs: Math.round(performance.now() - started),
      costUsd: costUsd(model, response.usage),
    }
  } catch (error) {
    return { ok: false, model, error: describeLlmError(error) }
  }
}
