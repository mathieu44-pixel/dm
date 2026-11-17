import { describe, expect, it } from 'vitest'
import { describeLlmError } from './errors'

function httpError(status: number) {
  return Object.assign(new Error('boom'), { status })
}

describe('describeLlmError', () => {
  it('explique une clé invalide', () => {
    expect(describeLlmError(httpError(401))).toMatch(/Clé API invalide/)
  })

  it('explique un manque de crédit ou une limite', () => {
    expect(describeLlmError(httpError(429))).toMatch(/429/)
  })

  it('gère les erreurs serveur génériques', () => {
    expect(describeLlmError(httpError(503))).toMatch(/503/)
    expect(describeLlmError(httpError(502))).toMatch(/502/)
  })

  it('explique une surcharge de Gemini', () => {
    expect(describeLlmError(Object.assign(new Error('UNAVAILABLE'), { status: 503, provider: 'gemini' }))).toMatch(/Google est surchargé/)
  })

  it('gère une interruption volontaire', () => {
    const abort = new Error('aborted')
    abort.name = 'APIUserAbortError'
    expect(describeLlmError(abort)).toBe('Génération interrompue.')
  })

  it('retombe sur le message brut sinon', () => {
    expect(describeLlmError('bizarre')).toBe('Erreur inattendue : bizarre')
  })
})

describe('describeLlmError (Gemini)', () => {
  it('reconnaît une clé Gemini invalide malgré le code 400', () => {
    const err = Object.assign(new Error('API key not valid. Please pass a valid API key.'), { status: 400, provider: 'gemini' })
    expect(describeLlmError(err)).toMatch(/Clé API invalide/)
  })

  it('explique le quota gratuit de Gemini', () => {
    const err = Object.assign(new Error('Resource exhausted'), { status: 429, provider: 'gemini' })
    expect(describeLlmError(err)).toMatch(/Quota gratuit de Gemini/)
  })
  it('reconnaît un modèle hors offre gratuite (quota 0)', () => {
    const err = Object.assign(new Error('Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-4-argon'), { status: 429, provider: 'gemini' })
    expect(describeLlmError(err)).toMatch(/pas inclus dans l'offre gratuite/)
  })
})
