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
  const raw = [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemma-3-27b-it', supportedGenerationMethods: ['generateContent'] },
  ]

  it('ne garde que les modèles de texte Gemini', () => {
    const ids = filterTextModels(raw).map((m) => m.id)
    expect(ids).toContain('gemini-2.5-flash')
    expect(ids).toContain('gemini-3-flash-preview')
    expect(ids).not.toContain('gemini-embedding-001')
    expect(ids).not.toContain('gemini-2.5-flash-preview-tts')
    expect(ids).not.toContain('gemma-3-27b-it')
  })

  it('préfère un Flash stable pour l\'histoire et un Flash-Lite pour les tâches internes', () => {
    expect(pickDefaultGeminiModels(filterTextModels(raw))).toEqual({
      story: 'gemini-2.5-flash',
      utility: 'gemini-2.5-flash-lite',
    })
  })

  it('gère une liste vide', () => {
    expect(pickDefaultGeminiModels([])).toEqual({ story: undefined, utility: undefined })
  })
})
