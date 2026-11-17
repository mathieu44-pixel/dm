import { useLiveQuery } from 'dexie-react-hooks'
import { BACKUP_REMINDER, needsBackupReminder } from '../engine/session/backupReminder'
import type { MemoryEntry } from '../engine/memory/types'
import type { Message, Session } from '../engine/session/types'
import { db } from './db'
import { blobToDataUrl, dataUrlToBlob } from './images'
import type { ImageAsset } from '../engine/images/types'
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
  memories: MemoryEntry[]
  /** Images encodées en texte (data URL) pour tenir dans le fichier JSON. */
  images: (Omit<ImageAsset, 'blob'> & { dataUrl: string })[]
  meta: MetaEntry[]
}

const TABLES = ['stories', 'characters', 'avatars', 'sessions', 'messages', 'memories', 'images', 'meta'] as const

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
    memories: backup.memories ?? [],
    images: backup.images ?? [],
    meta: backup.meta ?? [],
  }
}

export function summarizeBackup(b: Backup): string {
  return `${b.stories.length} histoire(s), ${b.avatars.length} avatar(s), ${b.sessions.length} partie(s), ${b.images.length} image(s)`
}

export async function exportAll(): Promise<Backup> {
  const [stories, characters, avatars, sessions, messages, memories, meta] = await Promise.all([
    db.stories.toArray(),
    db.characters.toArray(),
    db.avatars.toArray(),
    db.sessions.toArray(),
    db.messages.toArray(),
    db.memories.toArray(),
    db.meta.toArray(),
  ])
  const images = await Promise.all(
    (await db.images.toArray()).map(async ({ blob, ...rest }) => ({ ...rest, dataUrl: await blobToDataUrl(blob) })),
  )
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stories,
    characters,
    avatars,
    sessions,
    messages,
    memories,
    images,
    meta,
  }
}

/** Importe en fusionnant : un élément de même identifiant est remplacé, les autres sont conservés. */
export async function importBackup(backup: Backup): Promise<void> {
  // Les images sont reconverties avant la transaction (IndexedDB n'accepte pas d'attente externe pendant une transaction).
  const images: ImageAsset[] = await Promise.all(
    backup.images.map(async ({ dataUrl, ...rest }) => ({ ...rest, blob: await dataUrlToBlob(dataUrl) })),
  )
  await db.transaction('rw', [db.stories, db.characters, db.avatars, db.sessions, db.messages, db.memories, db.images, db.meta], async () => {
    await db.stories.bulkPut(backup.stories)
    await db.characters.bulkPut(backup.characters)
    await db.avatars.bulkPut(backup.avatars)
    await db.sessions.bulkPut(backup.sessions)
    await db.messages.bulkPut(backup.messages)
    await db.memories.bulkPut(backup.memories)
    await db.images.bulkPut(images)
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

/* ---------- Rappel de sauvegarde (v0.9.3) ---------- */

/** Exporte tout, télécharge le fichier et note la date de sauvegarde. Renvoie le résumé du contenu. */
export async function downloadBackup(): Promise<string> {
  const backup = await exportAll()
  downloadJson(`dm-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, backup)
  await db.meta.bulkPut([
    { key: 'lastBackupAt', value: Date.now() },
    { key: 'backupSnoozedUntil', value: 0 },
  ])
  return summarizeBackup(backup)
}

export async function snoozeBackupReminder(): Promise<void> {
  await db.meta.put({ key: 'backupSnoozedUntil', value: Date.now() + BACKUP_REMINDER.snoozeDays * 24 * 60 * 60 * 1000 })
}

export function useBackupReminder(): { show: boolean; lastBackupAt?: number } | undefined {
  return useLiveQuery(async () => {
    const [last, snooze, sessions] = await Promise.all([db.meta.get('lastBackupAt'), db.meta.get('backupSnoozedUntil'), db.sessions.toArray()])
    const lastBackupAt = typeof last?.value === 'number' ? last.value : undefined
    const state = {
      lastBackupAt,
      snoozedUntil: typeof snooze?.value === 'number' ? snooze.value : undefined,
      lastPlayedAt: sessions.reduce<number | undefined>((max, s) => (max === undefined || s.lastPlayedAt > max ? s.lastPlayedAt : max), undefined),
      totalTurns: sessions.reduce((n, s) => n + s.turn, 0),
    }
    return { show: needsBackupReminder(state), lastBackupAt }
  }, [])
}
