import { describe, expect, it } from 'vitest'
import type { ThreadEntry } from '../session/types'
import { buildSummaryRequest, planSummary, summaryIndex } from './summary'

const entries = (n: number, size = 10): ThreadEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i}`, role: i % 2 ? 'user' : 'ai', ooc: false, content: 'x'.repeat(size) }))

describe('planSummary', () => {
  it('ne fait rien tant que la partie est courte', () => {
    expect(planSummary(entries(30, 10), undefined, 1000, 10)).toBeNull()
  })

  it('résume les messages anciens en gardant le prologue et les 10 derniers', () => {
    const list = entries(30, 100)
    const plan = planSummary(list, undefined, 1000, 10)
    expect(plan).not.toBeNull()
    expect(plan!.toSummarize[0].id).toBe('e1')
    expect(plan!.toSummarize).toHaveLength(19)
    expect(plan!.coversUntilId).toBe('e19')
    expect(plan!.base).toBe('')
  })

  it('reprend après le résumé existant', () => {
    const list = entries(40, 100)
    const plan = planSummary(list, { text: 'Avant', coversUntilId: 'e19', updatedAt: 0 }, 1000, 10)
    expect(plan!.toSummarize[0].id).toBe('e20')
    expect(plan!.coversUntilId).toBe('e29')
    expect(plan!.base).toBe('Avant')
  })

  it('repart de zéro si le résumé ne correspond plus au fil', () => {
    const list = entries(30, 100)
    expect(summaryIndex(list, { text: 'x', coversUntilId: 'disparu', updatedAt: 0 })).toBe(-1)
    expect(planSummary(list, { text: 'x', coversUntilId: 'disparu', updatedAt: 0 }, 1000, 10)!.base).toBe('')
  })
})

describe('buildSummaryRequest', () => {
  it('inclut le résumé précédent et les nouveaux échanges', () => {
    const req = buildSummaryRequest('m', 'Annaelle', 'Ancien résumé', entries(2))
    expect(req.messages[0].content).toContain('Ancien résumé')
    expect(req.messages[0].content).toContain('JOUEUR (Annaelle)')
  })
})
