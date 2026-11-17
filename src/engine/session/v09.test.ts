import { describe, expect, it } from 'vitest'
import { addCost, addToLedger, formatTokens, mergeBreakdowns, monthKey, totalOf } from '../llm/costs'
import { searchEntries } from './search'
import { fileSlug, threadToText } from './transcript'
import type { ThreadEntry } from './types'

describe('coûts', () => {
  it('cumule dollars, appels et jetons par catégorie', () => {
    let b = addCost(undefined, 'story', 0.01, { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 500, cacheWriteTokens: 0 })
    b = addCost(b, 'story', 0.02, { inputTokens: 100, outputTokens: 50 })
    b = addCost(b, 'analysis', 0, { inputTokens: 300, outputTokens: 30 })
    expect(b.story).toEqual({ usd: 0.03, calls: 2, inputTokens: 1600, outputTokens: 250 })
    expect(totalOf(b)).toMatchObject({ calls: 3, inputTokens: 1900, outputTokens: 280 })
    expect(totalOf(mergeBreakdowns(b, b)).calls).toBe(6)
    expect(totalOf(undefined).usd).toBe(0)
  })
  it('range les dépenses par mois', () => {
    const t = new Date(2026, 10, 17).getTime()
    expect(monthKey(t)).toBe('2026-11')
    const ledger = addToLedger(addToLedger(undefined, t, 'creation', 0.05), t, 'story', 0.01)
    expect(Object.keys(ledger)).toEqual(['2026-11'])
    expect(totalOf(ledger['2026-11']).usd).toBeCloseTo(0.06)
  })
  it('affiche les jetons de façon compacte', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(12345)).toMatch(/^12,3\s?k$/)
    expect(formatTokens(2_400_000)).toMatch(/^2,4\s?M$/)
  })
})

const entries: ThreadEntry[] = [
  { id: 'a', role: 'ai', ooc: false, content: '「Le soleil se lève sur la Tracen Academy.」\nTrainer | "Bienvenue, Oguri. Ton entraîneur t\'attend."' },
  { id: 'b', role: 'user', ooc: false, content: '*Je cherche la cafétéria*' },
  { id: 'c', role: 'ai', ooc: false, content: '「La CAFETERIA est pleine. Une autre cafétéria, plus loin…」' },
]

describe('recherche', () => {
  it('ignore casse et accents, compte les occurrences', () => {
    const hits = searchEntries(entries, 'cafeteria')
    expect(hits.map((h) => h.id)).toEqual(['b', 'c'])
    expect(hits[0].match).toBe('cafétéria')
    expect(hits[1]).toMatchObject({ count: 2, match: 'CAFETERIA', index: 2 })
  })
  it('donne un aperçu sans balises', () => {
    const [hit] = searchEntries(entries, 'entraineur', { context: 10 })
    expect(hit.match).toBe('entraîneur')
    expect(hit.before.startsWith('…')).toBe(true)
    expect(hit.before + hit.match + hit.after).not.toContain('「')
  })
  it('exige au moins 2 caractères', () => {
    expect(searchEntries(entries, 'a')).toEqual([])
  })
})

describe('export texte', () => {
  it('met en forme narration, répliques et actions du joueur', () => {
    const text = threadToText([...entries, { id: 'd', role: 'user', ooc: true, content: 'note' }], { title: 'Tracen', playerName: 'Oguri' })
    expect(text).toContain('Le soleil se lève sur la Tracen Academy.')
    expect(text).toContain('Trainer : « Bienvenue, Oguri.')
    expect(text).toContain('▸ Oguri : *Je cherche la cafétéria*')
    expect(text).not.toContain('note')
  })
  it('produit un nom de fichier sûr', () => {
    expect(fileSlug("L'Ombre Grise de Tracen")).toBe('l-ombre-grise-de-tracen')
    expect(fileSlug('!!!')).toBe('partie')
  })
})

import { joinContinuation } from './thread'
import { isTruncated } from '../llm/gemini'

describe('suite de réponse coupée', () => {
  it('recolle un mot coupé', () => {
    expect(joinContinuation("「Isolde s'immobil", 'isa sur la marche.」')).toBe("「Isolde s'immobilisa sur la marche.」")
    expect(joinContinuation("「Isolde s'immobil", 'immobilisa sur la marche.」')).toBe("「Isolde s'immobilisa sur la marche.」")
  })
  it('poursuit une phrase coupée sur la même ligne', () => {
    expect(joinContinuation('「Elle pose le plat,', 'puis s’éloigne.」')).toBe('「Elle pose le plat, puis s’éloigne.」')
  })
  it('passe à la ligne après une fin de phrase', () => {
    expect(joinContinuation('「Il se tait.」', '\n「La pluie redouble.」')).toBe('「Il se tait.」\n「La pluie redouble.」')
  })
  it('reconnaît une réponse Gemini coupée par la limite', () => {
    expect(isTruncated('MAX_TOKENS')).toBe(true)
    expect(isTruncated('STOP')).toBe(false)
  })
})

import { needsBackupReminder } from './backupReminder'

describe('rappel de sauvegarde', () => {
  const day = 24 * 60 * 60 * 1000
  const now = 100 * day
  it('attend 10 tours avant le premier rappel', () => {
    expect(needsBackupReminder({ lastPlayedAt: now, totalTurns: 9 }, now)).toBe(false)
    expect(needsBackupReminder({ lastPlayedAt: now, totalTurns: 10 }, now)).toBe(true)
  })
  it('rappelle après 7 jours seulement si on a joué depuis', () => {
    expect(needsBackupReminder({ lastBackupAt: now - 8 * day, lastPlayedAt: now - day, totalTurns: 50 }, now)).toBe(true)
    expect(needsBackupReminder({ lastBackupAt: now - 8 * day, lastPlayedAt: now - 9 * day, totalTurns: 50 }, now)).toBe(false)
    expect(needsBackupReminder({ lastBackupAt: now - 3 * day, lastPlayedAt: now, totalTurns: 50 }, now)).toBe(false)
  })
  it('respecte le report', () => {
    expect(needsBackupReminder({ lastPlayedAt: now, totalTurns: 50, snoozedUntil: now + day }, now)).toBe(false)
  })
  it('ne rappelle rien sans partie jouée', () => {
    expect(needsBackupReminder({ totalTurns: 0 }, now)).toBe(false)
  })
})
