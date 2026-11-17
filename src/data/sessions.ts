import { useLiveQuery } from 'dexie-react-hooks'
import { initStats } from '../engine/progression/rules'
import { descendantIds } from '../engine/session/thread'
import type { Message, MessageVariant, Session } from '../engine/session/types'
import { db } from './db'
import { newId } from './storyModel'
import type { Avatar, Character, Story } from './types'

/* ---------- Lecture ---------- */

export function useSessionsForStory(storyId: string | undefined): Session[] | undefined {
  return useLiveQuery(async () => {
    if (!storyId) return []
    const list = await db.sessions.where('storyId').equals(storyId).toArray()
    return list.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
  }, [storyId])
}

export function useSessionData(sessionId: string | undefined) {
  return useLiveQuery(async () => {
    if (!sessionId) return null
    const session = await db.sessions.get(sessionId)
    if (!session) return null
    const [story, messages] = await Promise.all([
      db.stories.get(session.storyId),
      db.messages.where('sessionId').equals(sessionId).toArray(),
    ])
    if (!story) return null
    const characters = (await db.characters.bulkGet(story.characterIds)).filter((c): c is Character => !!c)
    return { session, story, characters, messages }
  }, [sessionId])
}

/**
 * Met à jour la date de dernière partie d'une histoire.
 * (Forme « modify » : le typage de `update` de Dexie ne supporte pas les conditions de fin, récursives.)
 */
async function touchStory(storyId: string, now: number): Promise<void> {
  await db.stories
    .where('id')
    .equals(storyId)
    .modify((story) => {
      story.lastPlayedAt = now
    })
}

export async function loadSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id)
}

/* ---------- Création ---------- */

/** Crée une partie : le prologue devient le premier message de l'IA. */
export async function createSession(story: Story, startSettingId: string, avatar: Avatar | null): Promise<string> {
  const start = story.startSettings.find((s) => s.id === startSettingId) ?? story.startSettings[0]
  const now = Date.now()
  const sessionId = newId()
  const prologue: Message = {
    id: newId(),
    sessionId,
    parentId: null,
    role: 'ai',
    variants: [{ content: start.prologue, createdAt: now }],
    activeVariant: 0,
    createdAt: now,
  }
  const session: Session = {
    id: sessionId,
    storyId: story.id,
    startSettingId: start.id,
    avatarId: avatar?.id ?? null,
    avatar: avatar ? { name: avatar.name, details: avatar.details, gift: avatar.gift } : null,
    title: story.title,
    activeLeafId: prologue.id,
    turn: 0,
    costUsd: 0,
    suggestions: start.initialSuggestions,
    stats: initStats(start.stats ?? []),
    endingsReached: [],
    createdAt: now,
    lastPlayedAt: now,
  }
  await db.transaction('rw', db.sessions, db.messages, db.stories, async () => {
    await db.sessions.add(session)
    await db.messages.add(prologue)
    await touchStory(story.id, now)
  })
  return sessionId
}

/* ---------- Modification ---------- */

export async function patchSession(id: string, patch: Partial<Session>): Promise<void> {
  await db.sessions.update(id, patch)
}

/** Ajoute un coût et éventuellement un tour, en relisant la valeur à jour (pas de valeur périmée). */
export async function addCostAndTurn(id: string, costUsd: number, turns = 0): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    await db.sessions.update(id, { costUsd: s.costUsd + costUsd, turn: s.turn + turns })
  })
}

/** Ajoute un message à la suite de la feuille active et en fait la nouvelle feuille. */
export async function appendMessage(
  session: Session,
  role: 'user' | 'ai',
  variant: MessageVariant,
  options: { ooc?: boolean; parentId?: string | null } = {},
): Promise<Message> {
  const now = Date.now()
  const message: Message = {
    id: newId(),
    sessionId: session.id,
    parentId: options.parentId !== undefined ? options.parentId : session.activeLeafId,
    role,
    ...(options.ooc ? { ooc: true } : {}),
    variants: [variant],
    activeVariant: 0,
    createdAt: now,
  }
  await db.transaction('rw', db.messages, db.sessions, db.stories, async () => {
    await db.messages.add(message)
    await db.sessions.update(session.id, { activeLeafId: message.id, lastPlayedAt: now })
    await touchStory(session.storyId, now)
  })
  return message
}

/** Ajoute une variante (régénération) et l'affiche. */
export async function addVariant(messageId: string, variant: MessageVariant): Promise<void> {
  await db.transaction('rw', db.messages, async () => {
    const m = await db.messages.get(messageId)
    if (!m) return
    const variants = [...m.variants, variant]
    await db.messages.update(messageId, { variants, activeVariant: variants.length - 1 })
  })
}

/** Remplace le texte de la variante affichée (modification manuelle ou « continuer »). */
export async function setActiveContent(messageId: string, content: string, extraCostUsd = 0): Promise<void> {
  await db.transaction('rw', db.messages, async () => {
    const m = await db.messages.get(messageId)
    if (!m) return
    const variants = m.variants.map((v, i) =>
      i === m.activeVariant ? { ...v, content, costUsd: (v.costUsd ?? 0) + extraCostUsd } : v,
    )
    await db.messages.update(messageId, { variants })
  })
}

export async function selectVariant(messageId: string, index: number): Promise<void> {
  const m = await db.messages.get(messageId)
  if (!m || index < 0 || index >= m.variants.length) return
  await db.messages.update(messageId, { activeVariant: index })
}

/**
 * Supprime un message et toute sa suite ; la feuille active revient au message précédent.
 * Le prologue (racine) ne peut pas être supprimé.
 */
export async function deleteFrom(session: Session, messageId: string): Promise<void> {
  await db.transaction('rw', db.messages, db.sessions, async () => {
    const message = await db.messages.get(messageId)
    if (!message || message.parentId === null) return
    const all = await db.messages.where('sessionId').equals(session.id).toArray()
    await db.messages.bulkDelete(descendantIds(all, messageId))
    await db.sessions.update(session.id, { activeLeafId: message.parentId, suggestions: [] })
  })
}

/** Supprime uniquement la suite d'un message (le message lui-même est conservé). */
export async function deleteAfter(session: Session, messageId: string): Promise<void> {
  await db.transaction('rw', db.messages, db.sessions, async () => {
    const all = await db.messages.where('sessionId').equals(session.id).toArray()
    const toDelete = descendantIds(all, messageId).filter((id) => id !== messageId)
    await db.messages.bulkDelete(toDelete)
    await db.sessions.update(session.id, { activeLeafId: messageId, suggestions: [] })
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.messages, db.memories, async () => {
    await db.messages.where('sessionId').equals(sessionId).delete()
    await db.memories.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

/**
 * Associe une image de scène au passage `messageId` (variante affichée) et la débloque dans la galerie.
 * Si le passage précédent montrait déjà la même image, on ne la répète pas (mais elle reste débloquée).
 */
export async function setSceneImage(sessionId: string, threadIds: string[], messageId: string, imageId: string): Promise<void> {
  await db.transaction('rw', db.messages, db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (session && !(session.unlockedImageIds ?? []).includes(imageId))
      await db.sessions.update(sessionId, { unlockedImageIds: [...(session.unlockedImageIds ?? []), imageId] })

    const index = threadIds.indexOf(messageId)
    const previous = (await db.messages.bulkGet(threadIds.slice(0, Math.max(0, index)))).filter((m): m is Message => !!m)
    const lastShown = [...previous].reverse().map((m) => m.variants[m.activeVariant]?.imageId).find(Boolean)
    if (lastShown === imageId) return

    const message = await db.messages.get(messageId)
    if (!message) return
    const variants = message.variants.map((v, i) => (i === message.activeVariant ? { ...v, imageId } : v))
    await db.messages.update(messageId, { variants })
  })
}
