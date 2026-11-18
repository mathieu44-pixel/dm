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
  await db.transaction('rw', [db.stories, db.characters, db.meta, db.images, db.sessions, db.messages, db.memories], async () => {
    const story = await db.stories.get(id)
    if (!story) return
    await db.characters.bulkDelete(story.characterIds)
    await db.images.where('storyId').equals(id).delete()
    // Les parties de l'histoire disparaissent avec elle (v0.9.7 : elles restaient orphelines).
    const sessionIds = (await db.sessions.where('storyId').equals(id).primaryKeys()) as string[]
    if (sessionIds.length) {
      await db.messages.where('sessionId').anyOf(sessionIds).delete()
      await db.memories.where('sessionId').anyOf(sessionIds).delete()
      await db.sessions.bulkDelete(sessionIds)
    }
    await db.stories.delete(id)
    // Supprimer l'exemple volontairement : on ne le réinstalle pas automatiquement.
    if (story.isExample) await db.meta.put({ key: 'exampleInstalled', value: true })
  })
}

/** Version du contenu de l'histoire d'exemple : l'augmenter met à jour l'exemple déjà installé. */
export const EXAMPLE_VERSION = 2

/**
 * Installe l'histoire d'exemple au premier lancement, puis la met à jour quand son contenu évolue
 * (v2 : jauges et fins). Si l'utilisateur l'a supprimée, elle n'est pas réinstallée.
 */
export async function ensureExampleStory(): Promise<void> {
  await db.transaction('rw', db.stories, db.characters, db.meta, async () => {
    const installed = await db.meta.get('exampleInstalled')
    const version = ((await db.meta.get('exampleVersion'))?.value as number | undefined) ?? 1
    if (installed?.value) {
      if (version >= EXAMPLE_VERSION) return
      const existing = await db.stories.get(EXAMPLE_STORY.id)
      if (existing) {
        await db.characters.bulkPut(EXAMPLE_CHARACTERS)
        await db.stories.put({ ...EXAMPLE_STORY, lastPlayedAt: existing.lastPlayedAt })
      }
    } else {
      await db.characters.bulkPut(EXAMPLE_CHARACTERS)
      await db.stories.put(EXAMPLE_STORY)
      await db.meta.put({ key: 'exampleInstalled', value: true })
    }
    await db.meta.put({ key: 'exampleVersion', value: EXAMPLE_VERSION })
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

/**
 * Nettoie les données laissées par les anciennes versions : parties d'histoires supprimées,
 * messages et souvenirs de parties supprimées. Renvoie le nombre de parties retirées.
 */
export async function cleanOrphans(): Promise<number> {
  return db.transaction('rw', [db.stories, db.sessions, db.messages, db.memories], async () => {
    const storyIds = new Set((await db.stories.toCollection().primaryKeys()) as string[])
    const sessions = await db.sessions.toArray()
    const orphanSessions = sessions.filter((s) => !storyIds.has(s.storyId)).map((s) => s.id)
    const liveSessions = new Set(sessions.map((s) => s.id).filter((id) => !orphanSessions.includes(id)))
    await db.sessions.bulkDelete(orphanSessions)
    await db.messages.filter((m) => !liveSessions.has(m.sessionId)).delete()
    await db.memories.filter((m) => !!m.sessionId && !liveSessions.has(m.sessionId)).delete()
    return orphanSessions.length
  })
}
