import { isModelId } from '../engine/llm/models'
import type { ProviderId } from '../engine/llm/types'
import { DEFAULT_SETTINGS, type AppSettings, type ProviderSettings } from './types'

/** Ancien format (v0.0.2) : une seule clé Anthropic à plat. */
interface LegacySettings {
  apiKey?: string
  storyModel?: string
  utilityModel?: string
}

type StoredSettings = Partial<Omit<AppSettings, 'anthropic' | 'gemini'>> & {
  anthropic?: Partial<ProviderSettings>
  gemini?: Partial<ProviderSettings>
} & LegacySettings

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Fusionne une ligne stockée (incomplète, ancienne ou corrompue) avec les valeurs par défaut. */
export function normalizeSettings(stored: StoredSettings | undefined): AppSettings {
  const s = stored ?? {}
  const legacyAnthropic: Partial<ProviderSettings> =
    s.apiKey !== undefined || s.storyModel !== undefined || s.utilityModel !== undefined
      ? { apiKey: s.apiKey, storyModel: s.storyModel, utilityModel: s.utilityModel }
      : {}
  const a = { ...legacyAnthropic, ...s.anthropic }
  const g = s.gemini ?? {}
  const defA = DEFAULT_SETTINGS.anthropic

  const provider: ProviderId = s.provider === 'anthropic' || s.provider === 'gemini' ? s.provider : DEFAULT_SETTINGS.provider

  return {
    id: 'app',
    provider,
    anthropic: {
      apiKey: str(a.apiKey),
      storyModel: isModelId(a.storyModel) ? a.storyModel : defA.storyModel,
      utilityModel: isModelId(a.utilityModel) ? a.utilityModel : defA.utilityModel,
    },
    gemini: {
      apiKey: str(g.apiKey),
      storyModel: str(g.storyModel),
      utilityModel: str(g.utilityModel),
    },
    updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : 0,
  }
}

/** Réglages du fournisseur actif. */
export function activeProvider(settings: AppSettings): ProviderSettings & { provider: ProviderId } {
  return { provider: settings.provider, ...settings[settings.provider] }
}

/** Le fournisseur actif est-il prêt à jouer (clé + modèles) ? */
export function isReady(settings: AppSettings): boolean {
  const p = settings[settings.provider]
  return !!p.apiKey && !!p.storyModel && !!p.utilityModel
}

/** Affiche une clé sous forme masquée : sk-ant-…a1b2 */
export function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 12) return '•'.repeat(key.length)
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}
