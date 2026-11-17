import { DEFAULT_STORY_MODEL, DEFAULT_UTILITY_MODEL, type ModelId } from '../engine/llm/models'

/** Réglages de l'application (une seule ligne, id « app »). */
export interface AppSettings {
  id: 'app'
  apiKey: string
  storyModel: ModelId
  utilityModel: ModelId
  updatedAt: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  apiKey: '',
  storyModel: DEFAULT_STORY_MODEL,
  utilityModel: DEFAULT_UTILITY_MODEL,
  updatedAt: 0,
}
