import { useLiveQuery } from 'dexie-react-hooks'
import { dedupeAdditions, overflowIds, type TurnAnalysis } from '../engine/memory/analysis'
import { MEMORY_LIMITS, type MemoryEntry, type MemoryKind } from '../engine/memory/types'
import { db } from './db'
import { newId } from './storyModel'

export function useMemories(sessionId: string | undefined): MemoryEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!sessionId) return []
    const list = await db.memories.where('sessionId').equals(sessionId).toArray()
    return list.sort((a, b) => a.createdAt - b.createdAt)
  }, [sessionId])
}

export async function loadMemories(sessionId: string): Promise<MemoryEntry[]> {
  const list = await db.memories.where('sessionId').equals(sessionId).toArray()
  return list.sort((a, b) => a.createdAt - b.createdAt)
}

export async function addMemory(sessionId: string, kind: MemoryKind, text: string, source: 'user' | 'ai' = 'user'): Promise<void> {
  const clean = text.trim().slice(0, MEMORY_LIMITS.entryText)
  if (!clean) return
  if (kind === 'long') {
    const count = await db.memories.where('sessionId').equals(sessionId).filter((m) => m.kind === 'long').count()
    if (count >= MEMORY_LIMITS.long) throw new Error(`Limite de ${MEMORY_LIMITS.long} souvenirs atteinte.`)
  }
  const now = Date.now()
  await db.memories.add({ id: newId(), sessionId, kind, text: clean, source, createdAt: now, updatedAt: now })
}

export async function updateMemory(id: string, patch: Partial<Pick<MemoryEntry, 'text' | 'kind'>>): Promise<void> {
  await db.memories.update(id, { ...patch, ...(patch.text !== undefined ? { text: patch.text.trim().slice(0, MEMORY_LIMITS.entryText) } : {}), updatedAt: Date.now() })
}

export async function deleteMemory(id: string): Promise<void> {
  await db.memories.delete(id)
}

/** Applique l'analyse de fin de tour : suppressions, ajouts (sans doublons), puis oubli au-delà de la limite. */
export async function applyMemoryChanges(sessionId: string, analysis: Pick<TurnAnalysis, 'add' | 'removeIds'>): Promise<void> {
  await db.transaction('rw', db.memories, async () => {
    if (analysis.removeIds.length) await db.memories.bulkDelete(analysis.removeIds)
    const all = await db.memories.where('sessionId').equals(sessionId).toArray()
    const additions = dedupeAdditions(analysis.add, all)
    const now = Date.now()
    await db.memories.bulkAdd(
      additions.map((a, i) => ({ id: newId(), sessionId, kind: a.kind, text: a.text, source: 'ai' as const, createdAt: now + i, updatedAt: now + i })),
    )
    const auto = (await db.memories.where('sessionId').equals(sessionId).toArray()).filter((m) => m.kind !== 'long')
    const overflow = overflowIds(auto)
    if (overflow.length) await db.memories.bulkDelete(overflow)
  })
}

/* ---------- Notes globales (toutes les parties) ---------- */

export function useGlobalNotes(): string | undefined {
  return useLiveQuery(async () => ((await db.meta.get('globalNotes'))?.value as string | undefined) ?? '', [])
}

export async function loadGlobalNotes(): Promise<string> {
  return ((await db.meta.get('globalNotes'))?.value as string | undefined) ?? ''
}

export async function saveGlobalNotes(text: string): Promise<void> {
  await db.meta.put({ key: 'globalNotes', value: text.slice(0, MEMORY_LIMITS.globalNotes) })
}
