import { describe, expect, it } from 'vitest'
import { formatLore, parseKeys, selectLore, type LoreEntry } from './lore'

const entries: LoreEntry[] = [
  { id: 'a', keys: ['Ignis', 'dragon rouge'], content: 'Ignis est un dragon rouge endormi sous la montagne.' },
  { id: 'b', keys: ['épée'], content: "L'épée de Valère brille près des morts-vivants." },
  { id: 'c', keys: [], content: 'Le royaume est en guerre.', alwaysOn: true },
  { id: 'd', keys: ['taverne'], content: 'La taverne du Corbeau.', disabled: true },
  { id: 'e', keys: ['art'], content: 'Les arts interdits.' },
]

describe('selectLore', () => {
  it('active les entrées dont un mot-clé apparaît (casse et accents ignorés)', () => {
    const ids = selectLore(entries, ['Je sors mon EPEE face au Dragon Rouge.']).map((e) => e.id)
    expect(ids).toEqual(['c', 'a', 'b'])
  })
  it('ne déclenche que sur des mots entiers', () => {
    expect(selectLore(entries, ['Je pars vers la gare.']).map((e) => e.id)).toEqual(['c'])
    expect(selectLore(entries, ["J'étudie l'art ancien."]).map((e) => e.id)).toContain('e')
  })
  it('ignore les entrées désactivées et les messages trop anciens', () => {
    expect(selectLore(entries, ['taverne']).map((e) => e.id)).toEqual(['c'])
    const old = ['Ignis', 'a', 'b', 'c', 'd']
    expect(selectLore(entries, old).map((e) => e.id)).toEqual(['c'])
  })
  it('respecte la taille maximale', () => {
    const ids = selectLore(entries, ['Ignis et son épée'], 60).map((e) => e.id)
    expect(ids).toEqual(['c'])
  })
  it('formate et lit les mots-clés', () => {
    expect(formatLore([entries[0]])).toBe('- [Ignis, dragon rouge] Ignis est un dragon rouge endormi sous la montagne.')
    expect(parseKeys(' dragon, Ignis ; wyrm,dragon ')).toEqual(['dragon', 'Ignis', 'wyrm'])
  })
})
