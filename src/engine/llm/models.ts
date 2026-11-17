/**
 * Catalogue des modèles Claude utilisables et calcul du coût d'un appel.
 * Tarifs : https://platform.claude.com/docs/en/about-claude/pricing (relevés le 17/11/2026), en $ par million de tokens.
 */

export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'

export interface ModelInfo {
  id: ModelId
  /** Nom affiché, dans l'esprit des niveaux d'OOC. */
  label: string
  /** Description courte pour le sélecteur. */
  hint: string
  /** Prix d'entrée et de sortie ($/MTok). `long` s'applique si le prompt dépasse `longPromptThreshold`. */
  price: { input: number; output: number; long?: { input: number; output: number } }
  longPromptThreshold?: number
  /** Multiplicateur du prix d'entrée pour une lecture de cache. */
  cacheReadMultiplier: number
}

export const MODELS: Record<ModelId, ModelInfo> = {
  'claude-opus-5-5': {
    id: 'claude-opus-5-5',
    label: 'Superb',
    hint: 'Claude Opus 5.5 — la meilleure plume',
    price: { input: 4, output: 20 },
    cacheReadMultiplier: 0.05,
  },
  'claude-sonnet-5-5': {
    id: 'claude-sonnet-5-5',
    label: 'Skillful',
    hint: 'Claude Sonnet 5.5 — très bon, moitié prix',
    price: { input: 2, output: 10 },
    cacheReadMultiplier: 0.05,
  },
  'claude-haiku-5-5': {
    id: 'claude-haiku-5-5',
    label: 'Basic',
    hint: 'Claude Haiku 5.5 — rapide et très économique',
    price: { input: 0.1, output: 0.5, long: { input: 0.5, output: 2.5 } },
    longPromptThreshold: 100_000,
    cacheReadMultiplier: 0.1,
  },
}

export const MODEL_LIST: ModelInfo[] = Object.values(MODELS)

export const DEFAULT_STORY_MODEL: ModelId = 'claude-opus-5-5'
export const DEFAULT_UTILITY_MODEL: ModelId = 'claude-haiku-5-5'

export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && value in MODELS
}

/** Compteurs renvoyés par l'API dans `usage`. */
export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/** Écriture en cache (durée 5 minutes) : 1,25 × le prix d'entrée. */
const CACHE_WRITE_MULTIPLIER = 1.25

/** Coût en dollars d'un appel, à partir des compteurs de tokens renvoyés par l'API. */
export function costUsd(modelId: ModelId, usage: Usage): number {
  const model = MODELS[modelId]
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const promptTokens = usage.input_tokens + cacheWrite + cacheRead

  const isLong = model.long && model.longPromptThreshold !== undefined && promptTokens > model.longPromptThreshold
  const rate = isLong && model.long ? model.long : model.price

  const dollars =
    usage.input_tokens * rate.input +
    cacheWrite * rate.input * CACHE_WRITE_MULTIPLIER +
    cacheRead * rate.input * model.cacheReadMultiplier +
    usage.output_tokens * rate.output

  return dollars / 1_000_000
}

/** Formate un montant en dollars de façon lisible pour de petites sommes. */
export function formatUsd(amount: number): string {
  if (amount === 0) return '0 $'
  if (amount < 0.01) return `${(amount * 100).toFixed(2).replace('.', ',')} ¢`
  return `${amount.toFixed(2).replace('.', ',')} $`
}
