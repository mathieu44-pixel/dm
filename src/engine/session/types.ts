import type { CostBreakdown } from '../llm/costs'
import type { SessionSummary } from '../memory/types'
import type { ReachedEnding } from '../progression/types'
import type { Language, ResponseLength } from './options'

/** Une version d'un message (régénérer crée une nouvelle variante). */
export interface MessageVariant {
  content: string
  createdAt: number
  /** Modèle qui a écrit cette variante (messages de l'IA). */
  model?: string
  costUsd?: number
  /** Image de scène affichée au-dessus de ce passage (v0.5). */
  imageId?: string
  /** Réponse coupée avant sa fin : l'écran propose de la continuer (v0.9.3). */
  truncated?: boolean
}

export interface Message {
  id: string
  sessionId: string
  /** Message précédent dans le fil (null pour le prologue). Le fil forme un arbre, prêt pour les branches (v0.6). */
  parentId: string | null
  role: 'user' | 'ai'
  /** Échange hors-jeu (commande /OOC) : ne fait pas avancer l'histoire. */
  ooc?: boolean
  variants: MessageVariant[]
  activeVariant: number
  createdAt: number
}

/** Copie de l'avatar au lancement : modifier l'avatar plus tard ne change pas une partie en cours. */
export interface AvatarSnapshot {
  name: string
  details: string
  gift: string
}

export interface Session {
  id: string
  storyId: string
  startSettingId: string
  avatarId: string | null
  avatar: AvatarSnapshot | null
  title: string
  /** Dernier message du fil affiché. */
  activeLeafId: string | null
  /** Nombre de tours joués (hors /OOC). */
  turn: number
  /** Coût cumulé estimé (0 avec une offre gratuite). */
  costUsd: number
  /** Détail des coûts par catégorie (v0.9, absent sur les parties plus anciennes). */
  costs?: CostBreakdown
  /** Actions proposées pour le prochain tour. */
  suggestions: string[]
  /** Notes du joueur pour cette partie (« User Notes » d'OOC). */
  userNotes?: string
  /** Résumé des échanges anciens (v0.3). */
  summary?: SessionSummary
  /** Valeurs des jauges (v0.4). */
  stats?: Record<string, number>
  /** Fins déjà atteintes dans cette partie. */
  endingsReached?: ReachedEnding[]
  /** Fin qui vient d'être atteinte, en attente d'affichage. */
  pendingEndingId?: string
  /** Images de scène débloquées (galerie, v0.5). */
  unlockedImageIds?: string[]
  /** Afficher les images de scène (par défaut : oui). */
  showImages?: boolean
  /** Longueur des réponses (v0.6). */
  length?: ResponseLength
  /** Style d'écriture : identifiant de STYLES, ou « custom ». */
  writingStyle?: string
  customStyle?: string
  /** Langue de jeu (v0.6). */
  language?: Language
  /** Surnoms reçus avec /GrantAlias. */
  aliases?: string[]
  createdAt: number
  lastPlayedAt: number
}

/** Message tel qu'il est lu dans le fil (variante active). */
export interface ThreadEntry {
  id: string
  role: 'user' | 'ai'
  ooc: boolean
  content: string
}

export function activeContent(message: Message): string {
  return message.variants[message.activeVariant]?.content ?? ''
}
