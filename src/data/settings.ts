import { useLiveQuery } from 'dexie-react-hooks'
import type { ProviderId } from '../engine/llm/types'
import { db } from './db'
import { normalizeSettings } from './settingsModel'
import type { AppSettings, ProviderSettings } from './types'

export async function loadSettings(): Promise<AppSettings> {
  return normalizeSettings(await db.settings.get('app'))
}

async function write(next: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings({ ...next, updatedAt: Date.now() })
  await db.settings.put(normalized)
  return normalized
}

export async function setActiveProvider(provider: ProviderId): Promise<AppSettings> {
  return write({ ...(await loadSettings()), provider })
}

export async function updateProviderSettings(provider: ProviderId, patch: Partial<ProviderSettings>): Promise<AppSettings> {
  const current = await loadSettings()
  return write({ ...current, [provider]: { ...current[provider], ...patch } })
}

/** Réglages réactifs : le composant se met à jour dès qu'ils changent. `undefined` pendant le chargement. */
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(loadSettings, [])
}
