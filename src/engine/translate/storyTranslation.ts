import type { Character, Story } from '../../data/types'
import type { ImageAsset } from '../images/types'
import type { LlmRequest } from '../llm/types'
import type { Language } from '../session/options'

/** Un texte à traduire, repéré par son chemin dans l'histoire (« c.2.personality », « st.0.sug.1 »…). */
export interface TranslationItem {
  key: string
  text: string
}

/** Liste de mots-clés ou de tags traduite comme une seule ligne « a, b, c ». */
const LIST_SEP = ', '

/** Tous les textes d'une histoire à traduire (les noms des personnages restent tels quels). */
export function collectTexts(story: Story, characters: Character[], images: ImageAsset[]): TranslationItem[] {
  const items: TranslationItem[] = []
  const add = (key: string, text: string | undefined) => {
    if (text && text.trim()) items.push({ key, text })
  }
  add('s.title', story.title)
  add('s.subtitle', story.subtitle)
  add('s.tags', story.tags.join(LIST_SEP))
  add('s.worldLore', story.worldLore)
  add('s.systemPrompt', story.systemPrompt)
  add('s.writingRules', story.writingRules)
  story.startSettings.forEach((st, i) => {
    add(`st.${i}.name`, st.name)
    add(`st.${i}.prologue`, st.prologue)
    st.initialSuggestions.forEach((s, j) => add(`st.${i}.sug.${j}`, s))
    st.stats?.forEach((stat, k) => {
      add(`st.${i}.stat.${k}.name`, stat.name)
      add(`st.${i}.stat.${k}.rules`, stat.rulesText)
      add(`st.${i}.stat.${k}.low`, stat.levels.low)
      add(`st.${i}.stat.${k}.mid`, stat.levels.mid)
      add(`st.${i}.stat.${k}.high`, stat.levels.high)
    })
    st.endings?.forEach((e, k) => {
      add(`st.${i}.end.${k}.name`, e.name)
      add(`st.${i}.end.${k}.card`, e.cardText)
      add(`st.${i}.end.${k}.epilogue`, e.epilogue)
    })
  })
  story.commands?.forEach((c, i) => {
    add(`cmd.${i}.description`, c.description)
    add(`cmd.${i}.instruction`, c.instruction)
  })
  story.lore?.forEach((l, i) => {
    add(`lore.${i}.keys`, l.keys.join(LIST_SEP))
    add(`lore.${i}.content`, l.content)
  })
  characters.forEach((c, i) => {
    add(`c.${i}.title`, c.title)
    add(`c.${i}.appearance`, c.appearance)
    add(`c.${i}.personality`, c.personality)
    add(`c.${i}.speech`, c.speech)
    add(`c.${i}.background`, c.background)
  })
  images.forEach((img, i) => {
    add(`img.${i}.description`, img.description)
    add(`img.${i}.tags`, img.tags.join(LIST_SEP))
  })
  return items
}

/** Regroupe les textes en lots d'environ `maxChars` caractères (un texte plus long forme son propre lot). */
export function chunkItems(items: TranslationItem[], maxChars = 6000): TranslationItem[][] {
  const chunks: TranslationItem[][] = []
  let current: TranslationItem[] = []
  let size = 0
  for (const item of items) {
    if (current.length && size + item.text.length > maxChars) {
      chunks.push(current)
      current = []
      size = 0
    }
    current.push(item)
    size += item.text.length
  }
  if (current.length) chunks.push(current)
  return chunks
}

const mark = (n: number) => `@@@ ${n} @@@`

/** Requête pour un lot : chaque texte précédé d'un repère numéroté, à recopier tel quel. */
export function buildChunkRequest(model: string, items: TranslationItem[], language: Language, characterNames: string[]): LlmRequest {
  const target = language === 'en' ? 'anglais' : 'français'
  return {
    model,
    maxTokens: 16000,
    temperature: 0.3,
    system: 'Tu es traductrice littéraire pour des histoires interactives. Tu renvoies uniquement les traductions, sans commentaire.',
    messages: [
      {
        role: 'user',
        content: [
          `Traduis en ${target} chacun des textes ci-dessous (fiches d'une histoire interactive).`,
          '- Recopie chaque repère « @@@ n @@@ » sur sa propre ligne, puis la traduction du texte qui le suit.',
          '- Garde la mise en forme : crochets 「 」, *astérisques*, sauts de ligne, listes, variables comme {{user}}.',
          `- Ne traduis pas les noms propres${characterNames.length ? ` (dont : ${characterNames.join(', ')})` : ''}.`,
          '- Une ligne « a, b, c » (mots-clés) reste une ligne de mots séparés par des virgules.',
          '- Un texte déjà dans la langue cible est recopié tel quel.',
          '',
          ...items.flatMap((item, i) => [mark(i + 1), item.text]),
        ].join('\n'),
      },
    ],
  }
}

/** Lit la réponse d'un lot : clé → traduction. Les repères manquants sont simplement absents. */
export function parseChunk(text: string, items: TranslationItem[]): Map<string, string> {
  const out = new Map<string, string>()
  const re = /^\s*@@@\s*(\d+)\s*@@@\s*$/gm
  const marks: { n: number; start: number; end: number }[] = []
  for (const m of text.matchAll(re)) marks.push({ n: Number(m[1]), start: m.index!, end: m.index! + m[0].length })
  marks.forEach((m, i) => {
    const item = items[m.n - 1]
    const body = text
      .slice(m.end, i + 1 < marks.length ? marks[i + 1].start : undefined)
      .replace(/```\s*$/, '')
      .trim()
    if (item && body) out.set(item.key, body)
  })
  return out
}

/** Applique les traductions (le texte d'origine est gardé là où la traduction manque). */
export function applyTranslations(
  story: Story,
  characters: Character[],
  images: ImageAsset[],
  t: Map<string, string>,
): { story: Story; characters: Character[]; images: ImageAsset[] } {
  const get = (key: string, original: string) => t.get(key) ?? original
  const list = (key: string, original: string[]) =>
    t.has(key)
      ? t
          .get(key)!
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : original
  const next: Story = {
    ...story,
    title: get('s.title', story.title),
    subtitle: get('s.subtitle', story.subtitle),
    tags: list('s.tags', story.tags),
    worldLore: get('s.worldLore', story.worldLore),
    systemPrompt: get('s.systemPrompt', story.systemPrompt),
    writingRules: get('s.writingRules', story.writingRules),
    startSettings: story.startSettings.map((st, i) => ({
      ...st,
      name: get(`st.${i}.name`, st.name),
      prologue: get(`st.${i}.prologue`, st.prologue),
      initialSuggestions: st.initialSuggestions.map((s, j) => get(`st.${i}.sug.${j}`, s)),
      stats: st.stats?.map((stat, k) => ({
        ...stat,
        name: get(`st.${i}.stat.${k}.name`, stat.name),
        rulesText: get(`st.${i}.stat.${k}.rules`, stat.rulesText),
        levels: {
          low: get(`st.${i}.stat.${k}.low`, stat.levels.low),
          mid: get(`st.${i}.stat.${k}.mid`, stat.levels.mid),
          high: get(`st.${i}.stat.${k}.high`, stat.levels.high),
        },
      })),
      endings: st.endings?.map((e, k) => ({
        ...e,
        name: get(`st.${i}.end.${k}.name`, e.name),
        cardText: get(`st.${i}.end.${k}.card`, e.cardText),
        epilogue: get(`st.${i}.end.${k}.epilogue`, e.epilogue),
      })),
    })),
    commands: story.commands?.map((c, i) => ({
      ...c,
      description: get(`cmd.${i}.description`, c.description),
      instruction: get(`cmd.${i}.instruction`, c.instruction),
    })),
    // Mots-clés : on garde les originaux et on ajoute les traduits (les noms propres restent reconnus).
    lore: story.lore?.map((l, i) => ({
      ...l,
      keys: [...new Set([...l.keys, ...list(`lore.${i}.keys`, [])])],
      content: get(`lore.${i}.content`, l.content),
    })),
  }
  const nextCharacters = characters.map((c, i) => ({
    ...c,
    title: get(`c.${i}.title`, c.title),
    appearance: get(`c.${i}.appearance`, c.appearance),
    personality: get(`c.${i}.personality`, c.personality),
    speech: get(`c.${i}.speech`, c.speech),
    background: get(`c.${i}.background`, c.background),
  }))
  const nextImages = images.map((img, i) => ({
    ...img,
    description: get(`img.${i}.description`, img.description),
    tags: [...new Set([...img.tags, ...list(`img.${i}.tags`, [])])],
  }))
  return { story: next, characters: nextCharacters, images: nextImages }
}

/**
 * Copie indépendante (nouveaux identifiants) : histoire, personnages et images,
 * avec toutes les références internes (portraits, couverture, humeurs, illustrations de fin) remises à jour.
 */
export function remapCopy(
  story: Story,
  characters: Character[],
  images: ImageAsset[],
  newId: () => string,
  now: number,
): { story: Story; characters: Character[]; images: ImageAsset[] } {
  const storyId = newId()
  const charIds = new Map(characters.map((c) => [c.id, newId()]))
  const imgIds = new Map(images.map((img) => [img.id, newId()]))
  const img = (id: string | undefined) => (id ? imgIds.get(id) : undefined)
  return {
    story: {
      ...story,
      id: storyId,
      characterIds: story.characterIds.map((id) => charIds.get(id) ?? id).filter((id) => [...charIds.values()].includes(id)),
      coverImageId: img(story.coverImageId),
      startSettings: story.startSettings.map((st) => ({
        ...st,
        endings: st.endings?.map((e) => ({ ...e, imageId: img(e.imageId) })),
      })),
      isExample: undefined,
      createdAt: now,
      updatedAt: now,
      lastPlayedAt: undefined,
    },
    characters: characters.map((c) => ({ ...c, id: charIds.get(c.id)!, portraitImageId: img(c.portraitImageId), createdAt: now, updatedAt: now })),
    images: images.map((i) => ({
      ...i,
      id: imgIds.get(i.id)!,
      storyId,
      characterId: i.characterId ? charIds.get(i.characterId) : undefined,
    })),
  }
}
