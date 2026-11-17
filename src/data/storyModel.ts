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
  })
  characters.forEach((c, i) => {
    if (!c.name.trim()) errors.push(`Le personnage n°${i + 1} n'a pas de nom.`)
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
