import { CARD_SITES, cardRequest, chubToCard, parseCardUrl, pygmalionToCard } from '../engine/import/cardUrl'
import { convertGreeting, extractCardFromPng, parseCharacterCard, substituteVariables, type CardData } from '../engine/import/sillytavern'
import { db } from './db'
import { addImages } from './images'
import { newId, parseTags } from './storyModel'
import type { Character, StartSetting, Story } from './types'

const MAX_GREETINGS = 5
const MAX_EXAMPLES = 2500

/** Construit une histoire en mode Character à partir d'une carte SillyTavern. */
export function cardToStory(card: CardData, now = Date.now()): { story: Story; character: Character } {
  const sub = (t: string) => substituteVariables(t, card.name, '{{user}}')
  const characterId = newId()
  const character: Character = {
    id: characterId,
    name: card.name,
    title: '',
    appearance: '',
    personality: sub(card.personality),
    speech: card.exampleDialogues ? `Exemples de dialogues :\n${sub(card.exampleDialogues).slice(0, MAX_EXAMPLES)}` : '',
    background: sub(card.description),
    createdAt: now,
    updatedAt: now,
  }

  const greetings = [card.firstMessage, ...card.alternateGreetings].filter(Boolean).slice(0, MAX_GREETINGS)
  const startSettings: StartSetting[] = (greetings.length ? greetings : [`「${card.name} est là.」`]).map((g, i) => ({
    id: newId(),
    name: i === 0 ? 'Accueil principal' : `Accueil ${i + 1}`,
    prologue: convertGreeting(sub(g), card.name),
    initialSuggestions: [],
  }))

  const lore = card.lore.map((e) => `- ${e.keys.length ? `${e.keys.join(', ')} : ` : ''}${sub(e.content)}`).join('\n')
  const story: Story = {
    id: newId(),
    title: card.name,
    subtitle: (card.creatorNotes || card.description).split(/\n/)[0].slice(0, 200),
    tags: parseTags(card.tags.join(',')),
    mode: 'character',
    worldLore: [sub(card.scenario), lore && `Lore :\n${lore}`].filter(Boolean).join('\n\n'),
    systemPrompt: [sub(card.systemPrompt), sub(card.postHistoryInstructions)].filter(Boolean).join('\n\n'),
    writingRules: '',
    characterIds: [characterId],
    startSettings,
    createdAt: now,
    updatedAt: now,
  }
  return { story, character }
}

/** Importe un fichier .json ou .png SillyTavern. Renvoie l'identifiant de l'histoire créée. */
export async function importCharacterFile(file: File): Promise<string> {
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name)
  let raw: unknown
  if (isPng) {
    raw = await extractCardFromPng(new Uint8Array(await file.arrayBuffer()))
    if (!raw) throw new Error("Cette image PNG ne contient pas de carte de personnage SillyTavern.")
  } else {
    try {
      raw = JSON.parse(await file.text())
    } catch {
      throw new Error("Ce fichier n'est pas un JSON valide.")
    }
  }
  return importCardData(raw, isPng ? file : undefined)
}

/** Enregistre une carte déjà lue ; l'image éventuelle devient couverture et portrait. */
export async function importCardData(raw: unknown, image?: Blob): Promise<string> {
  const { story, character } = cardToStory(parseCharacterCard(raw))

  await db.transaction('rw', db.stories, db.characters, async () => {
    await db.characters.add(character)
    await db.stories.add(story)
  })

  if (image) {
    const file = image instanceof File ? image : new File([image], `${character.name}.png`, { type: image.type || 'image/png' })
    const [imageId] = await addImages(story.id, [file], 'character')
    if (imageId) {
      await db.characters.update(character.id, { portraitImageId: imageId })
      await db.stories.where('id').equals(story.id).modify((s) => {
        s.coverImageId = imageId
      })
    }
  }
  return story.id
}

/* ---------- Import par lien (v0.9.4) ---------- */

const BLOCKED =
  "Ce site refuse l'accès direct depuis une application web. Télécharge la carte (.png ou .json) sur le site, puis importe le fichier."

async function get(url: string): Promise<Response> {
  let response: Response
  try {
    // Requête « simple » sans en-tête particulier : pas de pré-vérification CORS supplémentaire.
    response = await fetch(url)
  } catch {
    // Erreur réseau ou refus CORS : le navigateur ne fait pas la différence.
    throw new Error(navigator.onLine === false ? 'Pas de connexion internet.' : BLOCKED)
  }
  if (response.status === 404) throw new Error('Carte introuvable (lien erroné, carte supprimée ou privée).')
  if (response.status === 401 || response.status === 403) throw new Error('Cette carte demande d\'être connecté au site : télécharge-la manuellement.')
  if (!response.ok) throw new Error(`Le site a répondu ${response.status}. Réessaie plus tard ou télécharge le fichier.`)
  return response
}

/** L'image est facultative : si elle ne se télécharge pas, le personnage est importé sans portrait. */
async function tryImage(url: string | undefined): Promise<Blob | undefined> {
  if (!url) return undefined
  try {
    const blob = await (await get(url)).blob()
    return blob.type.startsWith('image/') ? blob : undefined
  } catch {
    return undefined
  }
}

/** Importe une carte depuis un lien Chub, RisuAI Realm, Pygmalion ou AICharacterCards. */
export async function importCharacterFromUrl(link: string): Promise<string> {
  const source = parseCardUrl(link)
  if (!source)
    throw new Error(`Lien non reconnu. Sites pris en charge : ${Object.values(CARD_SITES).join(', ')}. Pour les autres, télécharge le fichier.`)
  const request = cardRequest(source)
  const response = await get(request.url)

  if (request.kind === 'png') {
    const blob = await response.blob()
    const raw = await extractCardFromPng(new Uint8Array(await blob.arrayBuffer()))
    if (!raw) throw new Error("Le fichier reçu ne contient pas de carte de personnage.")
    return importCardData(raw, new File([blob], `${source.id.replace(/\W+/g, '-')}.png`, { type: 'image/png' }))
  }
  const json: unknown = await response.json()
  const { card, imageUrl } = request.kind === 'chub-json' ? chubToCard(json) : pygmalionToCard(json)
  return importCardData(card, await tryImage(imageUrl))
}
