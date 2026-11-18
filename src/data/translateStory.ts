import { db } from './db'
import { recordCost } from './costs'
import { newId } from './storyModel'
import type { AppSettings, Character, Story } from './types'
import { activeProvider } from './settingsModel'
import { createProvider } from '../engine/llm/client'
import { applyTranslations, buildChunkRequest, chunkItems, collectTexts, parseChunk, remapCopy } from '../engine/translate/storyTranslation'
import { textLanguage } from '../engine/import/universe'
import type { Language } from '../engine/session/options'

/** Langue réelle d'une histoire, d'après ses textes (à défaut, la langue réglée). */
export function storyLanguage(story: Story): Language {
  const sample = [story.startSettings[0]?.prologue, story.worldLore, story.subtitle].filter(Boolean).join('\n')
  return textLanguage(sample) ?? story.defaultLanguage ?? 'fr'
}

/**
 * Crée une copie traduite de l'histoire (personnages, lorebook, jauges, fins, images comprises).
 * L'original n'est pas modifié. Renvoie l'identifiant de la copie.
 */
export async function translateStoryCopy(
  settings: AppSettings,
  storyId: string,
  language: Language,
  onProgress: (done: number, total: number) => void,
): Promise<string> {
  const story = await db.stories.get(storyId)
  if (!story) throw new Error('Histoire introuvable.')
  const characters = (await db.characters.bulkGet(story.characterIds)).filter((c): c is Character => !!c)
  const images = await db.images.where('storyId').equals(storyId).toArray()

  const active = activeProvider(settings)
  const provider = createProvider(active.provider, active.apiKey)
  const chunks = chunkItems(collectTexts(story, characters, images))
  const names = characters.map((c) => c.name).filter(Boolean)
  const translations = new Map<string, string>()
  onProgress(0, chunks.length)
  for (const [i, chunk] of chunks.entries()) {
    let parsed = new Map<string, string>()
    // Une nouvelle tentative si la réponse est illisible ou incomplète.
    for (let attempt = 0; attempt < 2 && parsed.size < chunk.length; attempt++) {
      const result = await provider.complete(buildChunkRequest(active.utilityModel, chunk, language, names))
      await recordCost(null, 'creation', result)
      const got = parseChunk(result.text, chunk)
      if (got.size > parsed.size) parsed = got
    }
    if (parsed.size === 0) throw new Error(`l'IA n'a pas renvoyé de traduction lisible (lot ${i + 1}/${chunks.length})`)
    for (const [k, v] of parsed) translations.set(k, v)
    onProgress(i + 1, chunks.length)
  }

  const translated = applyTranslations(story, characters, images, translations)
  const copy = remapCopy(translated.story, translated.characters, translated.images, newId, Date.now())
  const tag = language === 'en' ? ' (EN)' : ' (FR)'
  copy.story.title = copy.story.title.replace(/\s*\((EN|FR)\)$/, '') + tag
  copy.story.defaultLanguage = language
  await db.transaction('rw', db.stories, db.characters, db.images, async () => {
    await db.images.bulkAdd(copy.images)
    await db.characters.bulkAdd(copy.characters)
    await db.stories.add(copy.story)
  })
  return copy.story.id
}
