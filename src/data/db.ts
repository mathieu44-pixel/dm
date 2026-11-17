import Dexie, { type EntityTable } from 'dexie'
import type { Message, Session } from '../engine/session/types'
import type { AppSettings, Avatar, Character, MetaEntry, Story } from './types'

/**
 * Base locale (IndexedDB). Chaque évolution du schéma passe par une nouvelle
 * `version(n)` : on ne modifie jamais une version déjà publiée.
 */
export class DmDatabase extends Dexie {
  settings!: EntityTable<AppSettings, 'id'>
  stories!: EntityTable<Story, 'id'>
  characters!: EntityTable<Character, 'id'>
  avatars!: EntityTable<Avatar, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>
  sessions!: EntityTable<Session, 'id'>
  messages!: EntityTable<Message, 'id'>

  constructor(name = 'dm') {
    super(name)
    this.version(1).stores({
      settings: 'id',
    })
    // v0.1b : histoires, personnages, avatars.
    this.version(2).stores({
      settings: 'id',
      stories: 'id, updatedAt, lastPlayedAt',
      characters: 'id',
      avatars: 'id, updatedAt',
      meta: 'key',
    })
    // v0.1c : parties et messages.
    this.version(3).stores({
      settings: 'id',
      stories: 'id, updatedAt, lastPlayedAt',
      characters: 'id',
      avatars: 'id, updatedAt',
      meta: 'key',
      sessions: 'id, storyId, lastPlayedAt',
      messages: 'id, sessionId',
    })
  }
}

export const db = new DmDatabase()
