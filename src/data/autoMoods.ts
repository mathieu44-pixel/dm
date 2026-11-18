import { db } from './db'
import { recordCost } from './costs'
import { activeProvider, isReady } from './settingsModel'
import type { AppSettings, Character } from './types'
import { createProvider } from '../engine/llm/client'
import { buildMoodVisionRequest, guessMoodFromWords, guessOwner, imageText, parseMoodVision } from '../engine/images/autoMood'
import type { ImageAsset, Mood } from '../engine/images/types'

export interface AutoMoodReport {
  /** Images rattachées à un personnage. */
  owners: number
  /** Humeurs trouvées d'après les mots. */
  byWords: number
  /** Humeurs trouvées par l'IA qui regarde les images. */
  byVision: number
  /** Images de personnage restées sans humeur. */
  unknown: number
}

/** Miniature JPEG en base64 (≤ 384 px) pour l'envoyer à l'IA sans gaspiller de requête. */
async function thumbnail(blob: Blob): Promise<{ mime: string; data: string }> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
  if (!out) throw new Error('miniature impossible')
  const bytes = new Uint8Array(await out.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { mime: 'image/jpeg', data: btoa(binary) }
}

/**
 * Rattache les images de personnage à leur personnage et leur donne une humeur, sans toucher
 * à ce qui est déjà réglé : d'abord d'après les mots (gratuit), puis, si `settings` est fourni,
 * en montrant les images stockées à l'IA (les images liées ne peuvent pas lui être envoyées).
 */
export async function autoAssignMoods(
  storyId: string,
  settings?: AppSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<AutoMoodReport> {
  const story = await db.stories.get(storyId)
  if (!story) return { owners: 0, byWords: 0, byVision: 0, unknown: 0 }
  const characters = (await db.characters.bulkGet(story.characterIds)).filter((c): c is Character => !!c)
  const images = (await db.images.where('storyId').equals(storyId).toArray()).filter((i) => i.category === 'character')
  const report: AutoMoodReport = { owners: 0, byWords: 0, byVision: 0, unknown: 0 }
  const pending: ImageAsset[] = []

  for (const img of images) {
    const patch: Partial<ImageAsset> = {}
    const owner = img.characterId ?? guessOwner(img, characters)
    if (owner && !img.characterId) {
      patch.characterId = owner
      report.owners++
    }
    if (!img.mood) {
      const mood = guessMoodFromWords(imageText(img))
      if (mood) {
        patch.mood = mood
        report.byWords++
      } else if (owner) pending.push({ ...img, ...patch })
    }
    if (Object.keys(patch).length) await db.images.update(img.id, patch)
  }

  // L'IA regarde les images stockées restées sans humeur, par lots de 6.
  const visible = pending.filter((i) => i.blob)
  if (settings && isReady(settings) && visible.length) {
    const active = activeProvider(settings)
    const provider = createProvider(active.provider, active.apiKey)
    const nameOf = (id?: string) => characters.find((c) => c.id === id)?.name ?? ''
    onProgress?.(0, visible.length)
    for (let i = 0; i < visible.length; i += 6) {
      const batch = visible.slice(i, i + 6)
      try {
        const items = await Promise.all(batch.map(async (img) => ({ name: nameOf(img.characterId), image: await thumbnail(img.blob!) })))
        const result = await provider.complete(buildMoodVisionRequest(active.utilityModel, items))
        await recordCost(null, 'command', result)
        const moods = parseMoodVision(result.text, batch.length)
        for (const [k, mood] of moods.entries()) {
          if (!mood) continue
          await db.images.update(batch[k].id, { mood: mood as Mood })
          report.byVision++
        }
      } catch {
        /* lot ignoré : le modèle ne voit peut-être pas les images, ou la limite gratuite est atteinte */
      }
      onProgress?.(Math.min(i + 6, visible.length), visible.length)
    }
  }
  report.unknown = pending.length - report.byVision
  return report
}

export function describeReport(r: AutoMoodReport): string {
  const parts = [`${r.byWords + r.byVision} humeur(s) attribuée(s)`]
  if (r.byVision) parts.push(`dont ${r.byVision} par l'IA`)
  if (r.owners) parts.push(`${r.owners} image(s) rattachée(s) à leur personnage`)
  if (r.unknown) parts.push(`${r.unknown} restée(s) sans humeur (à régler à la main)`)
  return parts.join(', ')
}
