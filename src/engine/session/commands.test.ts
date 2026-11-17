import { describe, expect, it } from 'vitest'
import { cleanCommandName, expandCustomCommand, parseCommand } from './commands'

const custom = [{ name: 'Flashback', description: '', instruction: 'Raconte un souvenir du passé du joueur.' }]

describe('parseCommand', () => {
  it('reconnaît les commandes intégrées sans tenir compte de la casse', () => {
    expect(parseCommand('/ooc résume')).toEqual({ kind: 'ooc', text: 'résume' })
    expect(parseCommand('/GRANTALIAS')).toEqual({ kind: 'alias', text: '' })
  })

  it('reconnaît une commande de l\'histoire', () => {
    expect(parseCommand('/flashback mon enfance', custom)).toEqual({ kind: 'custom', command: custom[0], text: 'mon enfance' })
  })

  it('laisse passer le texte normal et les commandes inconnues', () => {
    expect(parseCommand('Je frappe')).toEqual({ kind: 'none', text: 'Je frappe' })
    expect(parseCommand('/inconnue test', custom)).toEqual({ kind: 'none', text: '/inconnue test' })
  })
})

describe('expandCustomCommand', () => {
  it('remplace la commande par sa consigne', () => {
    expect(expandCustomCommand('/Flashback mon enfance', custom)).toBe('[Commande /Flashback : Raconte un souvenir du passé du joueur.]\nmon enfance')
  })
  it('ne touche pas aux autres messages', () => {
    expect(expandCustomCommand('Bonjour', custom)).toBe('Bonjour')
  })
})

describe('cleanCommandName', () => {
  it('retire barre oblique, espaces et caractères spéciaux', () => {
    expect(cleanCommandName(' /Mon Rêve! ')).toBe('MonRêve')
  })
})
