import { describe, expect, it } from 'vitest'
import { costUsd, formatUsd, isModelId } from './models'

describe('costUsd', () => {
  it('calcule entrée + sortie pour Opus 5.5', () => {
    // 1M tokens en entrée (4 $) + 100K en sortie (2 $)
    expect(costUsd('claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(6)
  })

  it('applique 1,25× pour l\'écriture en cache et le multiplicateur de lecture', () => {
    const cost = costUsd('claude-sonnet-5-5', {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    })
    // écriture 2 × 1,25 = 2,5 $ ; lecture 2 × 0,05 = 0,1 $
    expect(cost).toBeCloseTo(2.6)
  })

  it('bascule sur le tarif « prompt long » de Haiku au-delà de 100K tokens', () => {
    const short = costUsd('claude-haiku-5-5', { input_tokens: 100_000, output_tokens: 0 })
    const long = costUsd('claude-haiku-5-5', { input_tokens: 100_001, output_tokens: 0 })
    expect(short).toBeCloseTo(0.01)
    expect(long).toBeCloseTo(0.0500005)
  })

  it('accepte des compteurs de cache absents ou nuls', () => {
    expect(costUsd('claude-haiku-5-5', { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: null })).toBeGreaterThan(0)
  })
})

describe('formatUsd', () => {
  it('affiche les petites sommes en centimes', () => {
    expect(formatUsd(0.0025)).toBe('0,25 ¢')
    expect(formatUsd(1.5)).toBe('1,50 $')
    expect(formatUsd(0)).toBe('0 $')
  })
})

describe('isModelId', () => {
  it('reconnaît uniquement les modèles du catalogue', () => {
    expect(isModelId('claude-opus-5-5')).toBe(true)
    expect(isModelId('gpt-4')).toBe(false)
    expect(isModelId(undefined)).toBe(false)
  })
})
