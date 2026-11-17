import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, parseBackup, summarizeBackup } from './backup'
import { EXAMPLE_CHARACTERS, EXAMPLE_STORY } from './exampleStory'

describe('parseBackup', () => {
  it('accepte une sauvegarde valide et complète les tables absentes', () => {
    const backup = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stories: [EXAMPLE_STORY], characters: EXAMPLE_CHARACTERS }))
    expect(backup.stories).toHaveLength(1)
    expect(backup.sessions).toEqual([])
    expect(summarizeBackup(backup)).toBe('1 histoire(s), 0 avatar(s), 0 partie(s), 0 image(s)')
  })

  it('refuse un fichier non JSON ou étranger', () => {
    expect(() => parseBackup('pas du json')).toThrow(/JSON valide/)
    expect(() => parseBackup('{"a":1}')).toThrow(/pas une sauvegarde DM/)
  })

  it('refuse une version future', () => {
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))).toThrow(/plus récente/)
  })

  it('refuse des lignes sans identifiant', () => {
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, stories: [{ title: 'x' }] }))).toThrow(/endommagée/)
  })
})
