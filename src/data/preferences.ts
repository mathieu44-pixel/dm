import { useLiveQuery } from 'dexie-react-hooks'
import type { SpeechRate } from '../engine/speech/speech'
import { db } from './db'

/** Taille du texte de lecture (narration et dialogues). */
export type TextSize = 'sm' | 'md' | 'lg' | 'xl'

export const TEXT_SIZES: { id: TextSize; label: string; rem: number }[] = [
  { id: 'sm', label: 'Petit', rem: 0.95 },
  { id: 'md', label: 'Normal', rem: 1.05 },
  { id: 'lg', label: 'Grand', rem: 1.2 },
  { id: 'xl', label: 'Très grand', rem: 1.35 },
]

export const DEFAULT_TEXT_SIZE: TextSize = 'md'

export function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.some((s) => s.id === value)
}

export function textSizeRem(size: TextSize): number {
  return TEXT_SIZES.find((s) => s.id === size)?.rem ?? 1.05
}

/** Taille suivante ou précédente (bornée). */
export function stepTextSize(size: TextSize, delta: 1 | -1): TextSize {
  const index = TEXT_SIZES.findIndex((s) => s.id === size)
  const next = Math.min(TEXT_SIZES.length - 1, Math.max(0, index + delta))
  return TEXT_SIZES[next].id
}

export function useTextSize(): TextSize {
  return (
    useLiveQuery(async () => {
      const value = (await db.meta.get('textSize'))?.value
      return isTextSize(value) ? value : DEFAULT_TEXT_SIZE
    }, []) ?? DEFAULT_TEXT_SIZE
  )
}

export async function setTextSize(size: TextSize): Promise<void> {
  await db.meta.put({ key: 'textSize', value: size })
}

/* ---------- Lecture à voix haute (v0.9.6) ---------- */

export interface SpeechPrefs {
  auto: boolean
  rate: SpeechRate
}

export function useSpeechPrefs(): SpeechPrefs {
  return (
    useLiveQuery(async () => {
      const value = (await db.meta.get('speech'))?.value as Partial<SpeechPrefs> | undefined
      return { auto: !!value?.auto, rate: value?.rate ?? 'normal' }
    }, []) ?? { auto: false, rate: 'normal' }
  )
}

export async function setSpeechPrefs(p: Partial<SpeechPrefs>): Promise<void> {
  const current = ((await db.meta.get('speech'))?.value as Partial<SpeechPrefs> | undefined) ?? {}
  await db.meta.put({ key: 'speech', value: { auto: false, rate: 'normal', ...current, ...p } })
}
