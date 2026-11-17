import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { normalizeSettings } from './settingsModel'
import type { AppSettings } from './types'

export async function loadSettings(): Promise<AppSettings> {
  return normalizeSettings(await db.settings.get('app'))
}

export async function saveSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<AppSettings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch, updatedAt: Date.now() })
  await db.settings.put(next)
  return next
}

/** Réglages réactifs : le composant se met à jour dès qu'ils changent. `undefined` pendant le chargement. */
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(loadSettings, [])
}
