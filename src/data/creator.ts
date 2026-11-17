import { endingConditionItems, type CreationOptions, type StoryDraft } from '../engine/creator/storyDraft'
import type { EndingDef, StatDef } from '../engine/progression/types'
import { newCharacter, newEnding, newId, newStartSetting, newStat, newStory, parseTags } from './storyModel'
import type { Character, Story } from './types'

/** Convertit le brouillon de l'IA en histoire et personnages de l'application. */
export function draftToStory(draft: StoryDraft, options: CreationOptions, now = Date.now()): { story: Story; characters: Character[] } {
  const characters: Character[] = draft.characters.map((c) => ({ ...newCharacter(now), ...c }))

  const statIdByAlias = new Map<string, string>()
  const stats: StatDef[] = draft.stats.map((s, i) => {
    const def = newStat(i)
    statIdByAlias.set(s.alias, def.id)
    return { ...def, name: s.name, icon: s.icon, min: s.min, max: s.max, initial: s.initial, levels: s.levels, rulesText: s.rulesText }
  })
  const endings: EndingDef[] = draft.endings.map((e) => ({
    ...newEnding(),
    name: e.name,
    rarity: e.rarity,
    cardText: e.cardText,
    epilogue: e.epilogue,
    condition: { op: 'AND', items: endingConditionItems(e, statIdByAlias) },
  }))

  const isCharacter = options.mode === 'character'
  const start = {
    ...newStartSetting(isCharacter ? 'Accueil principal' : 'Départ principal'),
    prologue: draft.prologue,
    initialSuggestions: draft.suggestions,
    ...(stats.length ? { stats } : {}),
    ...(endings.length ? { endings } : {}),
  }

  const story: Story = {
    ...newStory(now),
    id: newId(),
    title: draft.title,
    subtitle: draft.subtitle,
    tags: parseTags(draft.tags.join(',')),
    mode: options.mode,
    // L'éditeur exige l'univers ou les consignes : on garde au moins l'idée de départ.
    worldLore: draft.worldLore || (draft.systemPrompt ? '' : `Idée de départ : ${options.idea.trim()}`),
    systemPrompt: draft.systemPrompt,
    writingRules: draft.writingRules,
    characterIds: characters.map((c) => c.id),
    startSettings: [start],
    defaultLanguage: options.language,
  }
  return { story, characters }
}
