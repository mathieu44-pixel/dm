import { describe, expect, it } from 'vitest'
import {
  assertNotBlocked,
  buildGeminiBody,
  extractText,
  filterTextModels,
  parseSseBuffer,
  pickDefaultGeminiModels,
  toUsage,
} from './gemini'

describe('buildGeminiBody', () => {
  it('convertit les rôles et place les consignes dans systemInstruction', () => {
    const body = buildGeminiBody({
      model: 'gemini-x',
      system: 'Tu es la narratrice.',
      messages: [
        { role: 'user', content: 'Bonjour' },
        { role: 'assistant', content: 'Salut' },
      ],
      maxTokens: 100,
    })
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Tu es la narratrice.' }] })
    expect(body.contents.map((c) => c.role)).toEqual(['user', 'model'])
    expect(body.generationConfig).toEqual({ maxOutputTokens: 100 })
  })
})

describe('extractText', () => {
  it('ignore les parties de réflexion interne', () => {
    expect(
      extractText({ candidates: [{ content: { parts: [{ text: 'pensée', thought: true }, { text: 'Réponse' }] } }] }),
    ).toBe('Réponse')
  })
})

describe('assertNotBlocked', () => {
  it('signale une demande bloquée', () => {
    expect(() => assertNotBlocked({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(/filtre de Gemini/)
  })
  it('laisse passer une fin normale', () => {
    expect(() => assertNotBlocked({ candidates: [{ finishReason: 'STOP' }] })).not.toThrow()
  })
})

describe('toUsage', () => {
  it('sépare le cache et compte les tokens de réflexion en sortie', () => {
    expect(
      toUsage({ promptTokenCount: 100, cachedContentTokenCount: 40, candidatesTokenCount: 10, thoughtsTokenCount: 5 }),
    ).toEqual({ inputTokens: 60, outputTokens: 15, cacheReadTokens: 40, cacheWriteTokens: 0 })
  })
})

describe('parseSseBuffer', () => {
  it('extrait les événements complets et garde le reste', () => {
    const a = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Bon' }] } }] })
    const b = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'jour' }] } }] })
    const { events, rest } = parseSseBuffer(`data: ${a}\r\n\r\ndata: ${b}\n\ndata: {"incomp`)
    expect(events.map(extractText)).toEqual(['Bon', 'jour'])
    expect(rest).toBe('data: {"incomp')
  })
})

describe('filterTextModels / pickDefaultGeminiModels', () => {
  const gen = ['generateContent']
  const raw = [
    { name: 'models/gemini-omni-1.1-flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-4-argon', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.6-flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.8-live', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.5-transcribe', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: gen },
    { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemma-3-27b-it', supportedGenerationMethods: gen },
  ]

  it('ne garde que les modèles de texte Gemini et signale les gratuits', () => {
    const models = filterTextModels(raw)
    const ids = models.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']))
    for (const excluded of ['gemini-omni-1.1-flash', 'gemini-3.8-live', 'gemini-3.5-transcribe', 'gemini-3.8-flash-tts', 'gemini-embedding-001', 'gemma-3-27b-it'])
      expect(ids).not.toContain(excluded)
    expect(models.find((m) => m.id === 'gemini-3.8-flash')?.label).toBe('Gemini 3.8 Flash (gratuit)')
  })

  it('choisit en priorité les modèles gratuits connus', () => {
    expect(pickDefaultGeminiModels(filterTextModels(raw))).toEqual({
      story: 'gemini-3.8-flash',
      utility: 'gemini-3.5-flash-lite',
    })
  })

  it('retombe sur un Flash / Flash-Lite si aucun modèle gratuit connu n\'est listé', () => {
    const options = ['gemini-9-flash', 'gemini-9-flash-lite', 'gemini-9-pro'].map((id) => ({ id, label: id }))
    expect(pickDefaultGeminiModels(options)).toEqual({ story: 'gemini-9-flash', utility: 'gemini-9-flash-lite' })
  })

  it('gère une liste vide', () => {
    expect(pickDefaultGeminiModels([])).toEqual({ story: undefined, utility: undefined })
  })
})
