import { describe, expect, it } from 'vitest'
import { buildPageExtractionRequest, looksEnglish, parsePageExtraction, textLanguage, universeContext } from './universe'

describe('extraction de page', () => {
  it('construit une requête avec le texte de la page et la langue', () => {
    const req = buildPageExtractionRequest('m', { title: 'Special Week', text: 'Special Week is…' }, 'fr', 'Umamusume')
    expect(req.messages[0].content).toContain('« Special Week »')
    expect(req.system).toContain('EN FRANÇAIS')
  })
  it('lit un personnage', () => {
    const e = parsePageExtraction('```json\n{"kind":"character","name":"Special Week","title":"Élève de Tracen","personality":"Joyeuse","keys":["Spe","Special Week","Spe"]}\n```', 'x')
    expect(e).toMatchObject({ kind: 'character', character: { name: 'Special Week', title: 'Élève de Tracen', personality: 'Joyeuse' }, keys: ['Spe', 'Special Week'] })
  })
  it('lit une fiche de lore et garde le titre si le nom manque', () => {
    expect(parsePageExtraction('{"kind":"lore","content":"Académie d’élite.","keys":[]}', 'Tracen Academy')).toEqual({
      kind: 'lore',
      name: 'Tracen Academy',
      keys: ['Tracen Academy'],
      content: 'Académie d’élite.',
    })
  })
  it('rejette une réponse illisible ou vide', () => {
    expect(parsePageExtraction('désolée', 'x')).toBeNull()
    expect(parsePageExtraction('{"kind":"lore","name":"x"}', 'x')).toBeNull()
  })
})

describe('universeContext', () => {
  it('liste personnages et fiches', () => {
    const text = universeContext({
      sourceTitle: 'List of Characters',
      worldText: 'Umamusume are horse girls.',
      characters: [{ name: 'Oguri Cap', title: 'Grey Monster', appearance: '', personality: '', speech: '', background: '' }],
      lore: [{ name: 'Tracen', content: 'École.' }],
    })
    expect(text).toContain('- Oguri Cap (Grey Monster)')
    expect(text).toContain('- Tracen : École.')
  })
})

describe('looksEnglish', () => {
  it('repère une fiche restée en anglais', () => {
    expect(looksEnglish('She is an extremely loud, chatty, and high-energy runner who treats everything like a party and loves to dance with her friends.')).toBe(true)
    expect(looksEnglish("Elle est une coureuse bruyante et pleine d'énergie, qui traite tout comme une fête avec ses amies.")).toBe(false)
    expect(looksEnglish('Daitaku Helios')).toBe(false)
  })
})

describe('textLanguage', () => {
  it('reconnaît un prologue français ou anglais', () => {
    expect(textLanguage("「Izumo, sur la vieille route sous la pluie. Les lanternes du sanctuaire grésillent, et l'eau ruisselle entre les pavés.」")).toBe('fr')
    expect(textLanguage('「Izumo, on the old road in the rain. The lanterns of the shrine sizzle and the water runs between the stones.」')).toBe('en')
    expect(textLanguage('Izumo')).toBeUndefined()
  })
})
