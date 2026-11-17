import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { EXAMPLE_CHARACTERS, EXAMPLE_STORY } from './exampleStory'
import type { Avatar, Character, Story } from './types'

/* ---------- Histoires ---------- */

/** Histoires triées : dernières jouées puis dernières modifiées. */
export function useStories(): Story[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.stories.toArray()
    return all.sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt))
  }, [])
}

/** Une histoire et ses personnages. `null` si introuvable, `undefined` pendant le chargement. */
export function useStory(id: string | undefined): { story: Story; characters: Character[] } | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null
    const story = await db.stories.get(id)
    if (!story) return null
    const characters = (await db.characters.bulkGet(story.characterIds)).filter((c): c is Character => !!c)
    return { story, characters }
  }, [id])
}

/**
 * Enregistre une histoire et ses personnages en une seule transaction.
 * Les personnages retirés de l'histoire sont supprimés.
 */
export async function saveStory(story: Story, characters: Character[]): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.stories, db.characters, async () => {
    const previous = await db.stories.get(story.id)
    const keptIds = new Set(characters.map((c) => c.id))
    const removed = (previous?.characterIds ?? []).filter((id) => !keptIds.has(id))
    if (removed.length) await db.characters.bulkDelete(removed)
    await db.characters.bulkPut(characters.map((c) => ({ ...c, updatedAt: now })))
    await db.stories.put({ ...story, characterIds: characters.map((c) => c.id), updatedAt: now })
  })
}

export async function deleteStory(id: string): Promise<void> {
  await db.transaction('rw', db.stories, db.characters, db.meta, async () => {
    const story = await db.stories.get(id)
    if (!story) return
    await db.characters.bulkDelete(story.characterIds)
    await db.stories.delete(id)
    // Supprimer l'exemple volontairement : on ne le réinstalle pas automatiquement.
    if (story.isExample) await db.meta.put({ key: 'exampleInstalled', value: true })
  })
}

/** Installe l'histoire d'exemple au premier lancement (une seule fois). */
export async function ensureExampleStory(): Promise<void> {
  await db.transaction('rw', db.stories, db.characters, db.meta, async () => {
    const done = await db.meta.get('exampleInstalled')
    if (done?.value) return
    await db.characters.bulkPut(EXAMPLE_CHARACTERS)
    await db.stories.put(EXAMPLE_STORY)
    await db.meta.put({ key: 'exampleInstalled', value: true })
  })
}

/** Réinstalle l'exemple (remplace la version existante). */
export async function reinstallExampleStory(): Promise<void> {
  await db.transaction('rw', db.stories, db.characters, async () => {
    await db.characters.bulkPut(EXAMPLE_CHARACTERS)
    await db.stories.put(EXAMPLE_STORY)
  })
}

/* ---------- Avatars ---------- */

export function useAvatars(): Avatar[] | undefined {
  return useLiveQuery(() => db.avatars.orderBy('updatedAt').reverse().toArray(), [])
}

export function useDefaultAvatarId(): string | null | undefined {
  return useLiveQuery(async () => ((await db.meta.get('defaultAvatarId'))?.value as string | undefined) ?? null, [])
}

export async function saveAvatar(avatar: Avatar): Promise<void> {
  await db.transaction('rw', db.avatars, db.meta, async () => {
    await db.avatars.put({ ...avatar, updatedAt: Date.now() })
    // Le premier avatar créé devient l'avatar par défaut.
    const current = await db.meta.get('defaultAvatarId')
    if (!current?.value) await db.meta.put({ key: 'defaultAvatarId', value: avatar.id })
  })
}

export async function setDefaultAvatar(id: string): Promise<void> {
  await db.meta.put({ key: 'defaultAvatarId', value: id })
}

export async function deleteAvatar(id: string): Promise<void> {
  await db.transaction('rw', db.avatars, db.meta, async () => {
    await db.avatars.delete(id)
    const current = await db.meta.get('defaultAvatarId')
    if (current?.value === id) {
      const next = await db.avatars.orderBy('updatedAt').last()
      await db.meta.put({ key: 'defaultAvatarId', value: next?.id ?? null })
    }
  })
}
