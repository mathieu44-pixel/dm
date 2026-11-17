import { describe, expect, it } from 'vitest'
import { applyDeltas, describeCondition, describeStat, evaluateCondition, findTriggeredEnding, initStats, statLevel } from './rules'
import type { EndingDef, StatDef } from './types'

const stat = (id: string, overrides: Partial<StatDef> = {}): StatDef => ({
  id,
  name: id,
  icon: '',
  color: '#fff',
  min: 0,
  max: 100,
  initial: 50,
  levels: { low: 'bas', mid: 'moyen', high: 'haut' },
  rulesText: '',
  ...overrides,
})

describe('initStats / applyDeltas', () => {
  const defs = [stat('a'), stat('b', { min: 0, max: 10, initial: 2 })]

  it('initialise et borne les valeurs', () => {
    expect(initStats(defs)).toEqual({ a: 50, b: 2 })
    expect(initStats(defs, { a: 500, b: 3 })).toEqual({ a: 100, b: 3 })
  })

  it('applique les variations en limitant leur amplitude et en bornant', () => {
    expect(applyDeltas(defs, { a: 50, b: 2 }, [{ statId: 'a', delta: 10 }])).toEqual({ a: 60, b: 2 })
    // variation limitée à la moitié de l'amplitude (50), puis bornée à 100
    expect(applyDeltas(defs, { a: 80, b: 2 }, [{ statId: 'a', delta: 300 }]).a).toBe(100)
    expect(applyDeltas(defs, { a: 50, b: 2 }, [{ statId: 'a', delta: -300 }]).a).toBe(0)
    expect(applyDeltas(defs, { a: 50, b: 2 }, [{ statId: 'b', delta: -9 }]).b).toBe(0)
  })

  it('ignore les jauges inconnues et les valeurs invalides', () => {
    expect(applyDeltas(defs, { a: 50, b: 2 }, [{ statId: 'zz', delta: 5 }, { statId: 'a', delta: Number.NaN }])).toEqual({ a: 50, b: 2 })
  })
})

describe('statLevel / describeStat', () => {
  it('découpe la jauge en tiers', () => {
    const d = stat('Confiance')
    expect(statLevel(d, 10)).toBe('low')
    expect(statLevel(d, 50)).toBe('mid')
    expect(statLevel(d, 90)).toBe('high')
    expect(describeStat(d, 90)).toBe('Confiance : 90/100 (haut)')
  })
})

describe('evaluateCondition', () => {
  const ctx = { turn: 12, stats: { a: 70, b: 3 } }

  it('gère tour, comparaisons, ET, OU et conditions imbriquées', () => {
    expect(evaluateCondition({ op: 'AND', items: [{ type: 'turn', gte: 10 }, { type: 'stat', statId: 'a', cmp: '>=', value: 70 }] }, ctx)).toBe(true)
    expect(evaluateCondition({ op: 'AND', items: [{ type: 'turn', gte: 20 }, { type: 'stat', statId: 'a', cmp: '>=', value: 70 }] }, ctx)).toBe(false)
    expect(evaluateCondition({ op: 'OR', items: [{ type: 'turn', gte: 20 }, { type: 'stat', statId: 'b', cmp: '<', value: 5 }] }, ctx)).toBe(true)
    expect(
      evaluateCondition(
        { op: 'AND', items: [{ type: 'turn', gte: 1 }, { op: 'OR', items: [{ type: 'stat', statId: 'a', cmp: '==', value: 1 }, { type: 'stat', statId: 'b', cmp: '==', value: 3 }] }] },
        ctx,
      ),
    ).toBe(true)
  })

  it('une condition vide ou une jauge absente ne se déclenche jamais', () => {
    expect(evaluateCondition({ op: 'AND', items: [] }, ctx)).toBe(false)
    expect(evaluateCondition({ op: 'AND', items: [{ type: 'stat', statId: 'zz', cmp: '<', value: 100 }] }, ctx)).toBe(false)
  })
})

describe('findTriggeredEnding', () => {
  const ending = (id: string, gte: number): EndingDef => ({ id, name: id, rarity: 'N', cardText: '', epilogue: '', condition: { op: 'AND', items: [{ type: 'turn', gte }] } })
  const endings = [ending('e1', 5), ending('e2', 10)]

  it('renvoie la première fin remplie et non encore atteinte', () => {
    expect(findTriggeredEnding(endings, { turn: 12, stats: {} })?.id).toBe('e1')
    expect(findTriggeredEnding(endings, { turn: 12, stats: {} }, [{ endingId: 'e1', turn: 5, reachedAt: 0 }])?.id).toBe('e2')
    expect(findTriggeredEnding(endings, { turn: 3, stats: {} })).toBeUndefined()
  })
})

describe('describeCondition', () => {
  it('produit une phrase lisible', () => {
    const defs = [stat('a', { name: 'Confiance' })]
    expect(describeCondition({ op: 'AND', items: [{ type: 'turn', gte: 10 }, { type: 'stat', statId: 'a', cmp: '>=', value: 60 }] }, defs)).toBe(
      'tour ≥ 10 ET Confiance ≥ 60',
    )
  })
})
