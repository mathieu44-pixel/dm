import { PROGRESSION_LIMITS, type Condition, type EndingDef, type StatDef } from '../engine/progression/types'
import type { Avatar, Character, StartSetting, Story } from './types'

/** Limites reprises d'OOC (avatars) ou fixées pour garder le contexte maîtrisé. */
export const LIMITS = {
  avatarName: 40,
  avatarDetails: 500,
  avatarGift: 300,
  storyTitle: 80,
  suggestions: 3,
  tags: 8,
} as const

export function newId(): string {
  return crypto.randomUUID()
}

export function newStartSetting(name = 'Départ principal'): StartSetting {
  return { id: newId(), name, prologue: '', initialSuggestions: [] }
}

const STAT_COLORS = ['#e8b04b', '#5fa8e8', '#e86f5f', '#6fd08c', '#c27be8', '#e8d35f', '#5fd0d0']

export function newStat(index = 0): StatDef {
  return {
    id: newId(),
    name: '',
    icon: '',
    color: STAT_COLORS[index % STAT_COLORS.length],
    min: 0,
    max: 100,
    initial: 50,
    levels: { low: '', mid: '', high: '' },
    rulesText: '',
  }
}

export function newEnding(): EndingDef {
  return { id: newId(), name: '', rarity: 'N', cardText: '', epilogue: '', condition: { op: 'AND', items: [{ type: 'turn', gte: 20 }] } }
}

/** Jauges référencées par une condition (y compris imbriquée). */
export function conditionStatIds(condition: Condition): string[] {
  return condition.items.flatMap((item) => ('op' in item ? conditionStatIds(item) : item.type === 'stat' ? [item.statId] : []))
}

export function newStory(now = Date.now()): Story {
  return {
    id: newId(),
    title: '',
    subtitle: '',
    tags: [],
    mode: 'story',
    worldLore: '',
    systemPrompt: '',
    writingRules: '',
    characterIds: [],
    startSettings: [newStartSetting()],
    createdAt: now,
    updatedAt: now,
  }
}

export function newCharacter(now = Date.now()): Character {
  return { id: newId(), name: '', title: '', appearance: '', personality: '', speech: '', background: '', createdAt: now, updatedAt: now }
}

export function newAvatar(now = Date.now()): Avatar {
  return { id: newId(), name: '', details: '', gift: '', createdAt: now, updatedAt: now }
}

/** « fantasy, Mystère ,, fantasy » → ["fantasy", "Mystère"] (sans doublons, limité). */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of input.split(',')) {
    const tag = raw.trim().replace(/^#/, '')
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= LIMITS.tags) break
  }
  return tags
}

/** Nettoie les suggestions : sans vides, sans espaces superflus, 3 au maximum. */
export function cleanSuggestions(suggestions: string[]): string[] {
  return suggestions.map((s) => s.trim()).filter(Boolean).slice(0, LIMITS.suggestions)
}

/** Problèmes bloquants avant enregistrement d'une histoire. Liste vide = valide. */
export function validateStory(story: Story, characters: Character[]): string[] {
  const errors: string[] = []
  if (!story.title.trim()) errors.push('Donne un titre à ton histoire.')
  if (story.title.length > LIMITS.storyTitle) errors.push(`Le titre dépasse ${LIMITS.storyTitle} caractères.`)
  if (!story.worldLore.trim() && !story.systemPrompt.trim())
    errors.push("Décris au moins l'univers ou les consignes de la narratrice.")
  if (story.startSettings.length === 0) errors.push('Il faut au moins un point de départ.')
  story.startSettings.forEach((s, i) => {
    if (!s.prologue.trim()) errors.push(`Le point de départ n°${i + 1} n'a pas de prologue.`)
    const stats = s.stats ?? []
    const endings = s.endings ?? []
    if (stats.length > PROGRESSION_LIMITS.stats) errors.push(`${PROGRESSION_LIMITS.stats} jauges au maximum.`)
    if (endings.length > PROGRESSION_LIMITS.endings) errors.push(`${PROGRESSION_LIMITS.endings} fins au maximum.`)
    stats.forEach((st, j) => {
      const label = st.name.trim() || `n°${j + 1}`
      if (!st.name.trim()) errors.push(`La jauge n°${j + 1} n'a pas de nom.`)
      if (!(st.min < st.max)) errors.push(`Jauge ${label} : le minimum doit être inférieur au maximum.`)
      else if (st.initial < st.min || st.initial > st.max) errors.push(`Jauge ${label} : la valeur de départ doit être entre ${st.min} et ${st.max}.`)
    })
    const statIds = new Set(stats.map((st) => st.id))
    endings.forEach((e, j) => {
      const label = e.name.trim() || `n°${j + 1}`
      if (!e.name.trim()) errors.push(`La fin n°${j + 1} n'a pas de nom.`)
      if (e.condition.items.length === 0) errors.push(`Fin ${label} : ajoute au moins une condition.`)
      if (conditionStatIds(e.condition).some((id) => !statIds.has(id))) errors.push(`Fin ${label} : une condition utilise une jauge supprimée.`)
    })
  })
  characters.forEach((c, i) => {
    if (!c.name.trim()) errors.push(`Le personnage n°${i + 1} n'a pas de nom.`)
  })
  const reserved = new Set(['ooc', 'grantalias'])
  const seenCommands = new Set<string>()
  ;(story.commands ?? []).forEach((c, i) => {
    const key = c.name.toLowerCase()
    if (!c.name) errors.push(`La commande n°${i + 1} n'a pas de nom.`)
    else if (reserved.has(key)) errors.push(`La commande /${c.name} existe déjà dans l'application.`)
    else if (seenCommands.has(key)) errors.push(`Deux commandes s'appellent /${c.name}.`)
    if (c.name && !c.instruction.trim()) errors.push(`La commande /${c.name} n'a pas de consigne.`)
    seenCommands.add(key)
  })
  const names = characters.map((c) => c.name.trim().toLowerCase()).filter(Boolean)
  if (new Set(names).size !== names.length) errors.push('Deux personnages portent le même nom.')
  return errors
}

export function validateAvatar(avatar: Avatar): string[] {
  const errors: string[] = []
  if (!avatar.name.trim()) errors.push('Le nom est obligatoire.')
  if (avatar.name.length > LIMITS.avatarName) errors.push(`Le nom dépasse ${LIMITS.avatarName} caractères.`)
  if (avatar.details.length > LIMITS.avatarDetails) errors.push(`Les détails dépassent ${LIMITS.avatarDetails} caractères.`)
  if (avatar.gift.length > LIMITS.avatarGift) errors.push(`Le don dépasse ${LIMITS.avatarGift} caractères.`)
  return errors
}
