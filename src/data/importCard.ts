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
  const { story, character } = cardToStory(parseCharacterCard(raw))

  await db.transaction('rw', db.stories, db.characters, async () => {
    await db.characters.add(character)
    await db.stories.add(story)
  })

  // L'image de la carte devient la couverture et le portrait du personnage.
  if (isPng) {
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
