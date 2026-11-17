import { describe, expect, it } from 'vitest'
import { convertGreeting, extractCardFromPng, parseCharacterCard, substituteVariables } from './sillytavern'

const v2 = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: 'Lyra',
    description: 'Une barde elfe.',
    personality: 'Espiègle',
    scenario: 'Une taverne.',
    first_mes: '*Elle accorde son luth.*\n"Bonsoir, {{user}} !"',
    mes_example: '<START>\n{{char}}: Bonjour.',
    alternate_greetings: ['Autre accueil'],
    system_prompt: '',
    post_history_instructions: '',
    creator_notes: 'Créée pour tester',
    tags: ['fantasy'],
    character_book: { entries: [{ keys: ['luth'], content: 'Le luth est enchanté.', enabled: true }, { keys: [], content: 'off', enabled: false }] },
  },
}

/** Construit un PNG minimal avec un bloc tEXt « chara » (CRC fictif : il n'est pas vérifié). */
function pngWithCard(card: unknown): Uint8Array {
  const json = JSON.stringify(card)
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
  const payload = new TextEncoder().encode(`chara\0${b64}`)
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    new DataView(out.buffer).setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    return out
  }
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', new Uint8Array(13)), chunk('tEXt', payload), chunk('IEND', new Uint8Array(0))]
  const total = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    total.set(p, o)
    o += p.length
  }
  return total
}

describe('parseCharacterCard', () => {
  it('lit une carte V2 et son lorebook (entrées actives seulement)', () => {
    const card = parseCharacterCard(v2)
    expect(card.name).toBe('Lyra')
    expect(card.alternateGreetings).toEqual(['Autre accueil'])
    expect(card.lore).toEqual([{ keys: ['luth'], content: 'Le luth est enchanté.' }])
    expect(card.creatorNotes).toBe('Créée pour tester')
  })

  it('lit une carte V1 à plat', () => {
    expect(parseCharacterCard({ name: 'Bob', first_mes: 'Salut' }).firstMessage).toBe('Salut')
  })

  it('refuse un fichier sans nom', () => {
    expect(() => parseCharacterCard({ data: {} })).toThrow(/nom manquant/)
  })
})

describe('extractCardFromPng', () => {
  it('retrouve la carte cachée dans le PNG, accents compris', () => {
    const card = extractCardFromPng(pngWithCard({ ...v2, data: { ...v2.data, name: 'Élodie' } })) as typeof v2
    expect(card.data.name).toBe('Élodie')
  })

  it('renvoie null pour un PNG sans carte et refuse un fichier non PNG', () => {
    const empty = pngWithCard({}).slice(0, 8 + 25) // signature + IHDR seulement
    expect(extractCardFromPng(empty)).toBeNull()
    expect(() => extractCardFromPng(new Uint8Array([1, 2, 3]))).toThrow(/PNG/)
  })
})

describe('conversion', () => {
  it('remplace les variables', () => {
    expect(substituteVariables('{{char}} salue {{user}} et <USER>', 'Lyra', 'Annaelle')).toBe('Lyra salue Annaelle et Annaelle')
  })

  it('convertit actions et répliques au format DM', () => {
    expect(convertGreeting('*Elle accorde son luth.*\n"Bonsoir !"\nElle *sourit* doucement.', 'Lyra')).toBe(
      '「Elle accorde son luth.」\nLyra | "Bonsoir !"\nElle sourit doucement.',
    )
  })
})
