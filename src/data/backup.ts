import type { Message, Session } from '../engine/session/types'
import { db } from './db'
import type { Avatar, Character, MetaEntry, Story } from './types'

/**
 * Sauvegarde complète des données (hors réglages : les clés API ne sont jamais exportées).
 */

export const BACKUP_FORMAT = 'dm-backup'
export const BACKUP_VERSION = 1

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  stories: Story[]
  characters: Character[]
  avatars: Avatar[]
  sessions: Session[]
  messages: Message[]
  meta: MetaEntry[]
}

const TABLES = ['stories', 'characters', 'avatars', 'sessions', 'messages', 'meta'] as const

/** Vérifie la structure d'un fichier de sauvegarde. Lève une erreur lisible sinon. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Ce fichier n'est pas un fichier JSON valide.")
  }
  if (typeof data !== 'object' || data === null || (data as { format?: unknown }).format !== BACKUP_FORMAT)
    throw new Error("Ce fichier n'est pas une sauvegarde DM.")
  const backup = data as Partial<Backup>
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION)
    throw new Error("Cette sauvegarde vient d'une version plus récente de DM : mets l'application à jour.")
  for (const table of TABLES) {
    const rows = backup[table]
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Sauvegarde endommagée (${table}).`)
    for (const row of (rows ?? []) as unknown[]) {
      const key = table === 'meta' ? 'key' : 'id'
      if (typeof row !== 'object' || row === null || typeof (row as Record<string, unknown>)[key] !== 'string')
        throw new Error(`Sauvegarde endommagée (${table}).`)
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: backup.version,
    exportedAt: backup.exportedAt ?? '',
    stories: backup.stories ?? [],
    characters: backup.characters ?? [],
    avatars: backup.avatars ?? [],
    sessions: backup.sessions ?? [],
    messages: backup.messages ?? [],
    meta: backup.meta ?? [],
  }
}

export function summarizeBackup(b: Backup): string {
  return `${b.stories.length} histoire(s), ${b.avatars.length} avatar(s), ${b.sessions.length} partie(s)`
}

export async function exportAll(): Promise<Backup> {
  const [stories, characters, avatars, sessions, messages, meta] = await Promise.all([
    db.stories.toArray(),
    db.characters.toArray(),
    db.avatars.toArray(),
    db.sessions.toArray(),
    db.messages.toArray(),
    db.meta.toArray(),
  ])
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), stories, characters, avatars, sessions, messages, meta }
}

/** Importe en fusionnant : un élément de même identifiant est remplacé, les autres sont conservés. */
export async function importBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', [db.stories, db.characters, db.avatars, db.sessions, db.messages, db.meta], async () => {
    await db.stories.bulkPut(backup.stories)
    await db.characters.bulkPut(backup.characters)
    await db.avatars.bulkPut(backup.avatars)
    await db.sessions.bulkPut(backup.sessions)
    await db.messages.bulkPut(backup.messages)
    await db.meta.bulkPut(backup.meta)
  })
}

/** Déclenche le téléchargement d'un fichier JSON. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
