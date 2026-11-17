import { DEFAULT_STORY_MODEL, DEFAULT_UTILITY_MODEL } from '../engine/llm/models'
import type { ProviderId } from '../engine/llm/types'
import type { EndingDef, StatDef } from '../engine/progression/types'

/* ---------- Réglages ---------- */

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

/* ---------- Histoires ---------- */

/** Personnage non joueur, incarné par l'IA. */
export interface Character {
  id: string
  name: string
  /** Rôle ou titre court (« Aubergiste », « Capitaine de la garde »…). */
  title: string
  appearance: string
  personality: string
  /** Façon de parler, tics de langage. */
  speech: string
  background: string
  /** Portrait (image de la banque de l'histoire, v0.5). */
  portraitImageId?: string
  createdAt: number
  updatedAt: number
}

/** Point de départ d'une partie (une histoire peut en proposer plusieurs). */
export interface StartSetting {
  id: string
  name: string
  /** Texte d'ouverture, au format narratif (「…」 et `Nom | "…"`). */
  prologue: string
  /** Jusqu'à 3 actions proposées au joueur au premier tour. */
  initialSuggestions: string[]
  /** Jauges (7 max, v0.4). Absent sur les histoires créées avant la v0.4. */
  stats?: StatDef[]
  /** Fins possibles (10 max, v0.4). */
  endings?: EndingDef[]
}

export type StoryMode = 'story' | 'character'

export interface Story {
  id: string
  title: string
  subtitle: string
  tags: string[]
  mode: StoryMode
  /** Univers, lieux, factions, règles du monde. */
  worldLore: string
  /** Consignes pour la narratrice (rôle, déroulement, limites). */
  systemPrompt: string
  /** Ton et style d'écriture souhaités. */
  writingRules: string
  characterIds: string[]
  startSettings: StartSetting[]
  /** Image de couverture (v0.5). */
  coverImageId?: string
  /** Histoire d'exemple fournie avec l'application. */
  isExample?: boolean
  createdAt: number
  updatedAt: number
  lastPlayedAt?: number
}

/* ---------- Avatars (personnage du joueur) ---------- */

export interface Avatar {
  id: string
  /** Nom par lequel les personnages t'appellent (40 caractères max). */
  name: string
  /** Ce que les personnages doivent savoir de toi (500 caractères max). */
  details: string
  /** Don, pouvoir ou talent particulier (facultatif). */
  gift: string
  createdAt: number
  updatedAt: number
}

/* ---------- Divers ---------- */

/** Petites valeurs persistantes (avatar par défaut, exemple installé…). */
export interface MetaEntry {
  key: string
  value: unknown
}
