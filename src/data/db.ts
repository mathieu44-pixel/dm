import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings } from './types'

/**
 * Base locale (IndexedDB). Chaque évolution du schéma passe par une nouvelle
 * `version(n)` : on ne modifie jamais une version déjà publiée.
 */
export class DmDatabase extends Dexie {
  settings!: EntityTable<AppSettings, 'id'>

  constructor(name = 'dm') {
    super(name)
    this.version(1).stores({
      settings: 'id',
    })
  }
}

export const db = new DmDatabase()
