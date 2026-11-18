import { describe, expect, it } from 'vitest'
import { buildAnthropicParams, DYNAMIC_CONTEXT_OPEN } from './anthropic'

const base = {
  model: 'claude-opus-5-5',
  maxTokens: 100,
  system: 'Consignes fixes',
  systemDynamic: 'Jauges : 40',
  cacheSystem: true,
  messages: [
    { role: 'user' as const, content: 'La partie commence.' },
    { role: 'assistant' as const, content: 'Prologue' },
    { role: 'user' as const, content: 'J’entre.' },
  ],
}

describe('buildAnthropicParams', () => {
  it('sans cache d’historique, le contexte reste dans le système', () => {
    const p = buildAnthropicParams(base)
    expect(p.system).toEqual([
      { type: 'text', text: 'Consignes fixes', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'Jauges : 40' },
    ])
    expect(p.messages[2]).toEqual({ role: 'user', content: 'J’entre.' })
  })
  it('avec cache d’historique, le contexte passe dans le dernier message et l’avant-dernier porte le point de cache', () => {
    const p = buildAnthropicParams({ ...base, cacheHistory: true })
    expect(p.system).toEqual([{ type: 'text', text: 'Consignes fixes', cache_control: { type: 'ephemeral' } }])
    expect(p.messages[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'Prologue', cache_control: { type: 'ephemeral' } }] })
    const last = p.messages[2].content as { text: string }[]
    expect(last[0].text.startsWith(DYNAMIC_CONTEXT_OPEN)).toBe(true)
    expect(last[0].text).toContain('Jauges : 40')
    expect(last[1].text).toBe('J’entre.')
  })
  it('garde le préfixe identique d’un tour à l’autre', () => {
    const t1 = buildAnthropicParams({ ...base, cacheHistory: true })
    const t2 = buildAnthropicParams({
      ...base,
      systemDynamic: 'Jauges : 55',
      cacheHistory: true,
      messages: [...base.messages, { role: 'assistant', content: 'Réponse' }, { role: 'user', content: 'Je m’assois.' }],
    })
    expect(t2.system).toEqual(t1.system)
    expect(JSON.stringify(t2.messages[0])).toBe(JSON.stringify(t1.messages[0]))
  })
})
