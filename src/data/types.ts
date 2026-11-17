import { DEFAULT_STORY_MODEL, DEFAULT_UTILITY_MODEL } from '../engine/llm/models'
import type { ProviderId } from '../engine/llm/types'

/** Clé et modèles choisis pour un fournisseur. */
export interface ProviderSettings {
  apiKey: string
  /** Modèle qui écrit l'histoire. */
  storyModel: string
  /** Modèle des tâches internes (suggestions, stats, résumés). */
  utilityModel: string
}

/** Réglages de l'application (une seule ligne, id « app »). */
export interface AppSettings {
  id: 'app'
  provider: ProviderId
  anthropic: ProviderSettings
  gemini: ProviderSettings
  updatedAt: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  provider: 'gemini',
  anthropic: { apiKey: '', storyModel: DEFAULT_STORY_MODEL, utilityModel: DEFAULT_UTILITY_MODEL },
  // Les modèles Gemini sont choisis après lecture de la liste disponible pour la clé.
  gemini: { apiKey: '', storyModel: '', utilityModel: '' },
  updatedAt: 0,
}
