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
