import { draftToStory } from './creator'
import { recordCost } from './costs'
import { addLinkedImage } from './images'
import { activeProvider } from './settingsModel'
import type { AppSettings } from './types'
import { saveStory } from './stories'
import { newId } from './storyModel'
import { buildCreationRequest, parseStoryDraft, type DraftCharacter } from '../engine/creator/storyDraft'
import { articleLinks, parseWikiUrl, wikiApiUrl } from '../engine/import/mediawiki'
import { buildPageExtractionRequest, extractionText, looksEnglish, parsePageExtraction, universeContext, UNIVERSE_LIMITS } from '../engine/import/universe'
import { createProvider } from '../engine/llm/client'
import type { LoreEntry } from '../engine/lore/lore'

/** Importer un univers depuis un wiki MediaWiki (v1.1). */

const BLOCKED = "Ce wiki refuse l'accès depuis une application web (ou pas de connexion). Utilise le copier-coller."

async function getJson(url: string): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error(BLOCKED)
  }
  if (!res.ok) throw new Error(`Le wiki a répondu ${res.status}.`)
  const json = (await res.json()) as Record<string, unknown>
  const err = (json.error as { info?: string } | undefined)?.info
  if (err) throw new Error(`Wiki : ${err}`)
  return json
}

function textOfHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, .navbox, .reference, .mw-editsection, sup, table.infobox ~ .toc, #toc').forEach((n) => n.remove())
  // Garde un saut de ligne entre les blocs pour que l'IA s'y retrouve.
  doc.querySelectorAll('p, li, h1, h2, h3, h4, tr, div').forEach((n) => n.append('\n'))
  return (doc.body.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

async function findApi(candidates: string[]): Promise<string> {
  let last: unknown
  for (const api of candidates) {
    try {
      await getJson(wikiApiUrl(api, { action: 'query', meta: 'siteinfo' }))
      return api
    } catch (e) {
      last = e
    }
  }
  throw last instanceof Error ? last : new Error(BLOCKED)
}

async function readPage(api: string, title: string): Promise<{ title: string; text: string; links: string[] }> {
  const json = await getJson(wikiApiUrl(api, { action: 'parse', page: title, prop: 'text|links', redirects: '1' }))
  const p = json.parse as { title?: string; text?: string; links?: unknown }
  return { title: p.title ?? title, text: textOfHtml(p.text ?? ''), links: articleLinks(p.links) }
}

export interface WikiIndex {
  api: string
  title: string
  text: string
  links: string[]
}

/** Lit la page indiquée (souvent une liste de personnages) et ses liens. */
export async function readWikiIndex(link: string): Promise<WikiIndex> {
  const target = parseWikiUrl(link)
  if (!target) throw new Error('Lien non reconnu : colle une adresse complète (https://…).')
  const api = await findApi(target.apiCandidates)
  const page = await readPage(api, target.title ?? 'Main_Page')
  return { api, ...page }
}

/** Adresse de l'image principale de chaque page (par lots de 50). */
async function pageImages(api: string, titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < titles.length; i += 50) {
    try {
      const json = await getJson(wikiApiUrl(api, { action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'pageimages', piprop: 'original', redirects: '1' }))
      const query = json.query as { pages?: { title: string; original?: { source: string } }[]; redirects?: { from: string; to: string }[] }
      const back = new Map((query.redirects ?? []).map((r) => [r.to, r.from]))
      for (const p of query.pages ?? []) if (p.original?.source) out.set(back.get(p.title) ?? p.title, p.original.source)
    } catch {
      /* images facultatives */
    }
  }
  return out
}

export interface ImportProgress {
  title: string
  status: 'pending' | 'reading' | 'done' | 'error'
  detail?: string
}

export interface UniverseImportOptions {
  index: WikiIndex
  titles: string[]
  idea: string
  introduction: string
  language: 'fr' | 'en'
  withProgression: boolean
  useIndexText: boolean
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Lit chaque page choisie, la fait ranger par l'IA, puis fait écrire l'histoire. Renvoie l'id de l'histoire. */
export async function importUniverse(
  settings: AppSettings,
  options: UniverseImportOptions,
  onProgress: (items: ImportProgress[], phase: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const active = activeProvider(settings)
  const provider = createProvider(active.provider, active.apiKey)
  const titles = options.titles.slice(0, UNIVERSE_LIMITS.pages)
  const items: ImportProgress[] = titles.map((title) => ({ title, status: 'pending' }))
  const report = (phase: string) => onProgress(items.map((i) => ({ ...i })), phase)
  const universe = options.index.title

  const images = await pageImages(options.index.api, titles)
  const characters: (DraftCharacter & { image?: string; keys: string[] })[] = []
  const lore: LoreEntry[] = []

  for (const [i, title] of titles.entries()) {
    if (signal?.aborted) throw new Error('Import annulé.')
    items[i].status = 'reading'
    report(`Lecture des pages (${i + 1}/${titles.length})`)
    try {
      const page = await readPage(options.index.api, title)
      let result = await provider.complete({ ...buildPageExtractionRequest(active.utilityModel, page, options.language, universe), signal })
      await recordCost(null, 'creation', result)
      let extracted = parsePageExtraction(result.text, page.title)
      // Les petits modèles recopient parfois la page sans traduire : une seconde tentative, plus insistante.
      if (extracted && options.language === 'fr' && looksEnglish(extractionText(extracted))) {
        result = await provider.complete({ ...buildPageExtractionRequest(active.utilityModel, page, options.language, universe, true), signal })
        await recordCost(null, 'creation', result)
        extracted = parsePageExtraction(result.text, page.title) ?? extracted
      }
      if (!extracted) throw new Error("réponse de l'IA illisible")
      if (extracted.kind === 'character') {
        characters.push({ ...extracted.character, keys: extracted.keys, image: images.get(title) })
        items[i] = { title, status: 'done', detail: `Personnage : ${extracted.character.name}` }
      } else {
        lore.push({ id: newId(), keys: extracted.keys, content: `${extracted.name} — ${extracted.content}` })
        items[i] = { title, status: 'done', detail: `Fiche : ${extracted.name}` }
      }
    } catch (e) {
      items[i] = { title, status: 'error', detail: e instanceof Error ? e.message : String(e) }
    }
    report(`Lecture des pages (${i + 1}/${titles.length})`)
    // Ménage les quotas des offres gratuites.
    if (i < titles.length - 1) await pause(800)
  }
  if (!characters.length && !lore.length) throw new Error("Aucune page n'a pu être importée.")

  report("Écriture de l'histoire")
  const creation = {
    idea: options.idea,
    mode: 'story' as const,
    language: options.language,
    withProgression: options.withProgression,
    presetCharacters: characters.length > 0,
    introduction: options.introduction,
    context: universeContext({
      sourceTitle: options.index.title,
      worldText: options.useIndexText ? options.index.text : '',
      characters,
      lore: lore.map((l) => ({ name: l.keys[0] ?? '', content: l.content })),
    }),
  }
  const result = await provider.complete({ ...buildCreationRequest(active.storyModel, creation), signal })
  await recordCost(null, 'creation', result)
  const draft = parseStoryDraft(result.text, creation)
  draft.characters = characters.map((c) => ({
    name: c.name,
    title: c.title,
    appearance: c.appearance,
    personality: c.personality,
    speech: c.speech,
    background: c.background,
  }))
  const { story, characters: saved } = draftToStory(draft, creation)
  story.lore = [...lore, ...(story.lore ?? [])]
  await saveStory(story, saved)

  // Portraits liés depuis le wiki (affichés depuis leur adresse).
  report('Portraits')
  for (const [i, c] of characters.entries()) {
    if (!c.image) continue
    const imageId = await addLinkedImage(story.id, c.image, 'character', [c.name, ...c.keys], `Portrait de ${c.name}`)
    saved[i].portraitImageId = imageId
    if (!story.coverImageId) story.coverImageId = imageId
  }
  if (characters.some((c) => c.image)) await saveStory(story, saved)
  return story.id
}
