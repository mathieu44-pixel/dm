import { isModelId } from '../engine/llm/models'
import { DEFAULT_SETTINGS, type AppSettings } from './types'

/** Fusionne une ligne stockée (éventuellement incomplète ou ancienne) avec les valeurs par défaut. */
export function normalizeSettings(stored: Partial<AppSettings> | undefined): AppSettings {
  const storyModel = stored?.storyModel
  const utilityModel = stored?.utilityModel
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    id: 'app',
    apiKey: (stored?.apiKey ?? '').trim(),
    storyModel: isModelId(storyModel) ? storyModel : DEFAULT_SETTINGS.storyModel,
    utilityModel: isModelId(utilityModel) ? utilityModel : DEFAULT_SETTINGS.utilityModel,
  }
}

/** Affiche une clé sous forme masquée : sk-ant-…a1b2 */
export function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 12) return '•'.repeat(key.length)
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}
