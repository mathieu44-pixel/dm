import { useLiveQuery } from 'dexie-react-hooks'
import { activeContent, type Session } from '../engine/session/types'
import { db } from './db'
import type { Story } from './types'

export interface SessionSummary {
  session: Session
  storyTitle: string
  /** Début du dernier message, pour se rappeler où on en était. */
  excerpt: string
}

/** Extrait lisible d'un message : sans balises 「」 ni noms de personnages, tronqué. */
export function makeExcerpt(text: string, max = 140): string {
  const plain = text
    .replace(/[「」]/g, '')
    .replace(/^[^\n|]{1,40}\|\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain
}

/** Parties (toutes, ou celles d'une histoire), de la plus récente à la plus ancienne. */
export function useSessionSummaries(storyId?: string): SessionSummary[] | undefined {
  return useLiveQuery(async () => {
    const sessions = storyId
      ? await db.sessions.where('storyId').equals(storyId).toArray()
      : await db.sessions.toArray()
    sessions.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    const storyList = (await db.stories.bulkGet([...new Set(sessions.map((s) => s.storyId))])).filter((s): s is Story => !!s)
    const stories = new Map(storyList.map((s) => [s.id, s.title]))
    const leaves = await db.messages.bulkGet(sessions.map((s) => s.activeLeafId ?? ''))
    return sessions.map((session, i) => {
      const leaf = leaves[i]
      return {
        session,
        storyTitle: stories.get(session.storyId) ?? 'Histoire supprimée',
        excerpt: leaf ? makeExcerpt(activeContent(leaf)) : '',
      }
    })
  }, [storyId])
}

/** « il y a 5 min », « hier », « 12 nov. » */
export function formatRelativeDate(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined })
}
