/**
 * Contrat commun à tous les fournisseurs d'IA. Le reste de l'application ne connaît
 * que ces types : changer ou ajouter un fournisseur ne touche pas au moteur de jeu.
 */

export type ProviderId = 'anthropic' | 'gemini'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  model: string
  /** Consignes système (univers, règles…). */
  system?: string
  messages: ChatMessage[]
  maxTokens: number
  temperature?: number
  signal?: AbortSignal
}

/** Compteurs de tokens, harmonisés entre fournisseurs. */
export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface LlmResult {
  text: string
  usage: LlmUsage
  /** Coût estimé en dollars (0 pour une offre gratuite). */
  costUsd: number
}

export interface ModelOption {
  id: string
  label: string
  hint?: string
}

export interface LlmProvider {
  id: ProviderId
  /** Réponse complète en une fois. */
  complete(request: LlmRequest): Promise<LlmResult>
  /** Réponse affichée au fil de l'eau : `onText` reçoit chaque morceau de texte. */
  stream(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult>
  /** Modèles disponibles pour cette clé. */
  listModels(): Promise<ModelOption[]>
}

/** Erreur d'API normalisée : `status` = code HTTP quand il existe. */
export class LlmError extends Error {
  readonly status?: number
  readonly provider: ProviderId
  readonly kind?: 'blocked' | 'empty'

  constructor(message: string, provider: ProviderId, options: { status?: number; kind?: 'blocked' | 'empty' } = {}) {
    super(message)
    this.name = 'LlmError'
    this.provider = provider
    this.status = options.status
    this.kind = options.kind
  }
}
