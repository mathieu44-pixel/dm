import { describe, expect, it } from 'vitest'
import type { ThreadEntry } from '../session/types'
import { buildTurnAnalysisRequest, dedupeAdditions, overflowIds, parseTurnAnalysis } from './analysis'
import type { MemoryEntry } from './types'

const mem = (id: string, kind: MemoryEntry['kind'], text: string, createdAt = 0): MemoryEntry => ({
  id,
  sessionId: 's',
  kind,
  text,
  source: 'ai',
  createdAt,
  updatedAt: createdAt,
})

describe('buildTurnAnalysisRequest', () => {
  it('présente la mémoire avec des alias courts et les derniers échanges', () => {
    const entries: ThreadEntry[] = [
      { id: '1', role: 'ai', ooc: false, content: 'Prologue' },
      { id: '2', role: 'user', ooc: false, content: 'Je bois' },
    ]
    const req = buildTurnAnalysisRequest('m', 'Annaelle', entries, [mem('x', 'goal', 'Trouver la lettre')])
    const text = req.messages[0].content
    expect(text).toContain('m1 [goal] Trouver la lettre')
    expect(text).toContain('JOUEUR (Annaelle)')
  })
})

describe('parseTurnAnalysis', () => {
  const memories = [mem('id-a', 'goal', 'Trouver la lettre'), mem('id-b', 'fact', 'Il pleut')]

  it('lit suggestions, ajouts et suppressions (alias convertis en identifiants)', () => {
    const result = parseTurnAnalysis(
      'Voici : {"suggestions":["A","B","C"],"add":[{"type":"relation","text":"Maëlle se méfie d\'Annaelle."}],"remove":["m1","m9"]}',
      memories,
    )
    expect(result.suggestions).toEqual(['A', 'B', 'C'])
    expect(result.add).toEqual([{ kind: 'relation', text: "Maëlle se méfie d'Annaelle." }])
    expect(result.removeIds).toEqual(['id-a'])
  })

  it('remplace un type inconnu par « fact » et limite à 3 ajouts', () => {
    const add = Array.from({ length: 5 }, (_, i) => ({ type: 'autre', text: `t${i}` }))
    const result = parseTurnAnalysis(JSON.stringify({ suggestions: [], add }), [])
    expect(result.add).toHaveLength(3)
    expect(result.add[0].kind).toBe('fact')
  })

  it('se rabat sur les suggestions seules si le JSON est illisible', () => {
    const result = parseTurnAnalysis('1. Fuir\n2. Parler\n3. Attendre', memories)
    expect(result.suggestions).toEqual(['Fuir', 'Parler', 'Attendre'])
    expect(result.add).toEqual([])
    expect(result.removeIds).toEqual([])
  })
})

describe('dedupeAdditions', () => {
  it('ignore les doublons de la mémoire et du lot lui-même', () => {
    const existing = [mem('a', 'fact', 'Il pleut.')]
    const result = dedupeAdditions(
      [
        { kind: 'fact', text: 'il pleut' },
        { kind: 'goal', text: 'Fuir' },
        { kind: 'goal', text: 'fuir.' },
      ],
      existing,
    )
    expect(result).toEqual([{ kind: 'goal', text: 'Fuir' }])
  })
})

describe('overflowIds', () => {
  it('oublie d\'abord les faits les plus anciens', () => {
    const list = [mem('g1', 'goal', 'g', 1), mem('f1', 'fact', 'f', 2), mem('f2', 'fact', 'f', 3), mem('r1', 'relation', 'r', 4)]
    expect(overflowIds(list, 2)).toEqual(['f1', 'f2'])
    expect(overflowIds(list, 1)).toEqual(['f1', 'f2', 'g1'])
    expect(overflowIds(list, 10)).toEqual([])
  })
})

describe('jauges dans l\'analyse de fin de tour', () => {
  const defs = [
    { id: 'conf', name: 'Confiance', icon: '', color: '#fff', min: 0, max: 100, initial: 30, levels: { low: 'méfiante', mid: '', high: '' }, rulesText: 'Monte si le joueur aide Maëlle.' },
    { id: 'ind', name: 'Indices', icon: '', color: '#fff', min: 0, max: 10, initial: 0, levels: { low: '', mid: '', high: '' }, rulesText: '' },
  ]

  it('présente les jauges avec alias, valeur et règle', () => {
    const req = buildTurnAnalysisRequest('m', 'Annaelle', [], [], { defs, values: { conf: 30, ind: 2 } })
    const text = req.messages[0].content
    expect(text).toContain('s1 — Confiance : 30/100 (méfiante) (entre 0 et 100). Règle : Monte si le joueur aide Maëlle.')
    expect(text).toContain('"stats"')
  })

  it("n'évoque pas les jauges quand l'histoire n'en a pas", () => {
    expect(buildTurnAnalysisRequest('m', 'A', [], []).messages[0].content).not.toContain('"stats"')
  })

  it('convertit les alias en identifiants et ignore les valeurs invalides', () => {
    const result = parseTurnAnalysis('{"stats":[{"id":"s1","delta":10},{"id":"s2","delta":"-1"},{"id":"s9","delta":3},{"id":"s1","delta":"x"}]}', [], defs)
    expect(result.statDeltas).toEqual([
      { statId: 'conf', delta: 10 },
      { statId: 'ind', delta: -1 },
    ])
  })
})

describe("images de scène dans l'analyse de fin de tour", () => {
  const images = [
    { id: 'img-a', tags: ['salle commune', 'nuit'], description: 'La salle commune éclairée par le feu' },
    { id: 'img-b', tags: ['Isolde'], description: '' },
  ]

  it('présente le catalogue avec des alias', () => {
    const text = buildTurnAnalysisRequest('m', 'A', [], [], undefined, images).messages[0].content
    expect(text).toContain('i1 — salle commune, nuit : La salle commune éclairée par le feu')
    expect(text).toContain('i2 — Isolde')
    expect(text).toContain('"image": "i2"')
  })

  it("convertit l'alias choisi en identifiant ; null ou inconnu = pas d'image", () => {
    expect(parseTurnAnalysis('{"image":"i2"}', [], [], images).imageId).toBe('img-b')
    expect(parseTurnAnalysis('{"image":null}', [], [], images).imageId).toBeUndefined()
    expect(parseTurnAnalysis('{"image":"i7"}', [], [], images).imageId).toBeUndefined()
  })
})

describe('affinités dans l’analyse', () => {
  it('liste les personnages rencontrés et lit leurs variations', () => {
    const req = buildTurnAnalysisRequest('m', 'Annaelle', [], [], undefined, [], 'fr', [
      { id: 'yuri', name: 'Han Yuri', value: 62 },
      { id: 'hwa', name: 'Hong Hwaryeon', value: 40 },
    ])
    expect(req.messages[0].content).toContain('c1 — Han Yuri : 62/100')
    expect(req.messages[0].content).toContain('"affinity"')
    const r = parseTurnAnalysis('{"affinity":[{"id":"c2","delta":-4},{"id":"c9","delta":2},{"id":"c1","delta":"3"}]}', [], [], [], ['yuri', 'hwa'])
    expect(r.affinityDeltas).toEqual([
      { characterId: 'hwa', delta: -4 },
      { characterId: 'yuri', delta: 3 },
    ])
  })
  it('omet le champ sans personnage rencontré', () => {
    expect(buildTurnAnalysisRequest('m', 'A', [], []).messages[0].content).not.toContain('"affinity"')
  })
})

describe('expressions dans l’analyse', () => {
  it('propose les humeurs illustrées et lit le choix', () => {
    const req = buildTurnAnalysisRequest('m', 'A', [], [], undefined, [], 'fr', [], [{ name: 'Han Yuri', moods: ['neutral', 'angry'] }])
    expect(req.messages[0].content).toContain('e1 — Han Yuri : neutral, angry')
    const r = parseTurnAnalysis('{"expressions":[{"id":"e1","mood":"Angry"},{"id":"e1","mood":"furieuse"},{"id":"e4","mood":"sad"}]}', [], [], [], [], ['Han Yuri'])
    expect(r.expressions).toEqual([{ name: 'Han Yuri', mood: 'angry' }])
  })
})
