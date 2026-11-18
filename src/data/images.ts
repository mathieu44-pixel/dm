import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { IMAGE_LIMITS, type ImageAsset, type ImageCategory } from '../engine/images/types'
import { db } from './db'
import { fitWithin } from '../engine/images/utils'
import { newId } from './storyModel'

/** Redimensionne et compresse une image (WebP) avant stockage. */
async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, IMAGE_LIMITS.maxDimension)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Impossible de traiter l'image sur cet appareil.")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', IMAGE_LIMITS.quality))
  if (!blob) throw new Error("Échec de la compression de l'image.")
  return { blob, width, height }
}

/** Ajoute des images à la banque d'une histoire. Renvoie les identifiants créés. */
export async function addImages(storyId: string, files: File[], category: ImageCategory = 'scene'): Promise<string[]> {
  const count = await db.images.where('storyId').equals(storyId).count()
  const room = IMAGE_LIMITS.perStory - count
  if (room <= 0) throw new Error(`Limite de ${IMAGE_LIMITS.perStory} images atteinte pour cette histoire.`)
  const ids: string[] = []
  for (const file of files.slice(0, room)) {
    if (!file.type.startsWith('image/')) continue
    const { blob, width, height } = await compress(file)
    const id = newId()
    const description = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
    await db.images.add({ id, storyId, blob, mime: blob.type, width, height, category, tags: [], description, createdAt: Date.now() })
    ids.push(id)
  }
  return ids
}

export async function updateImage(id: string, patch: Partial<Pick<ImageAsset, 'category' | 'tags' | 'description'>>): Promise<void> {
  await db.images.update(id, patch)
}

export async function deleteImage(id: string): Promise<void> {
  await db.images.delete(id)
}

/** Métadonnées des images d'une histoire (sans charger les fichiers dans les listes). */
export function useStoryImages(storyId: string | undefined): ImageAsset[] | undefined {
  return useLiveQuery(async () => {
    if (!storyId) return []
    const list = await db.images.where('storyId').equals(storyId).toArray()
    return list.sort((a, b) => a.createdAt - b.createdAt)
  }, [storyId])
}

/** Catégories d'images affichables pendant la partie (et débloquées dans la galerie). */
export const ILLUSTRATION_CATEGORIES = ['scene', 'character'] as const

export function isIllustration(image: Pick<ImageAsset, 'category'>): boolean {
  return (ILLUSTRATION_CATEGORIES as readonly string[]).includes(image.category)
}

/** Images de scène et de personnages d'une histoire, proposées à l'IA pour illustrer la partie. */
export async function loadSceneImages(storyId: string): Promise<ImageAsset[]> {
  const list = await db.images.where('storyId').equals(storyId).toArray()
  return list.filter(isIllustration).sort((a, b) => a.createdAt - b.createdAt)
}

/** Adresse affichable d'une image stockée (libérée automatiquement). */
export function useImageUrl(id: string | undefined): string | undefined {
  const asset = useLiveQuery(async () => (id ? await db.images.get(id) : undefined), [id])
  const blob = asset?.blob
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  return url ?? asset?.url
}

/** Ajoute une image liée (affichée depuis son adresse, non stockée). Renvoie son identifiant. */
export async function addLinkedImage(
  storyId: string,
  url: string,
  category: ImageCategory,
  tags: string[] = [],
  description = '',
): Promise<string> {
  const id = newId()
  await db.images.add({ id, storyId, url, mime: '', width: 0, height: 0, category, tags, description, createdAt: Date.now() })
  return id
}

/* ---------- Sauvegarde : images ↔ texte ---------- */

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}
