import { describe, expect, it } from 'vitest'
import { formatRelativeDate, makeExcerpt } from './history'

describe('makeExcerpt', () => {
  it('retire les balises de narration et les noms de personnages', () => {
    expect(makeExcerpt('「La pluie tombe.」\nMaëlle | "Entre."')).toBe('La pluie tombe. "Entre."')
  })

  it('tronque les textes longs', () => {
    const excerpt = makeExcerpt('mot '.repeat(100), 20)
    expect(excerpt.length).toBeLessThanOrEqual(20)
    expect(excerpt.endsWith('…')).toBe(true)
  })
})

describe('formatRelativeDate', () => {
  const now = new Date('2026-11-17T16:00:00').getTime()
  it('affiche des durées récentes lisibles', () => {
    expect(formatRelativeDate(now - 30_000, now)).toBe("à l'instant")
    expect(formatRelativeDate(now - 5 * 60_000, now)).toBe('il y a 5 min')
    expect(formatRelativeDate(now - 3 * 3_600_000, now)).toBe('il y a 3 h')
    expect(formatRelativeDate(now - 26 * 3_600_000, now)).toBe('hier')
    expect(formatRelativeDate(now - 3 * 86_400_000, now)).toBe('il y a 3 jours')
  })
})
