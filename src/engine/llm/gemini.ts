import { LlmError, type LlmProvider, type LlmRequest, type LlmResult, type LlmUsage, type ModelOption } from './types'

/**
 * Fournisseur Google Gemini (API « Generative Language », offre gratuite via Google AI Studio).
 * Appels REST directs avec fetch : pas de dépendance supplémentaire.
 * Doc : https://ai.google.dev/api
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/* ---------- Construction de la requête ---------- */

export function buildGeminiBody(request: LlmRequest) {
  const system = [request.system, request.systemDynamic].filter(Boolean).join('\n\n')
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: request.maxTokens,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    },
  }
}

/* ---------- Lecture des réponses ---------- */

interface GeminiPart {
  text?: string
  thought?: boolean
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>
  promptFeedback?: { blockReason?: string }
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
    cachedContentTokenCount?: number
  }
}

const BLOCKING_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'OTHER'])

/** Texte d'un morceau de réponse (on ignore les « pensées » internes du modèle). */
export function extractText(chunk: GeminiResponse): string {
  const parts = chunk.candidates?.[0]?.content?.parts ?? []
  return parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
}

/** Lève une erreur si Gemini a bloqué la demande ou la réponse. */
export function assertNotBlocked(chunk: GeminiResponse): void {
  const blockReason = chunk.promptFeedback?.blockReason
  if (blockReason) throw new LlmError(`Demande refusée par le filtre de Gemini (${blockReason}).`, 'gemini', { kind: 'blocked' })
  const finish = chunk.candidates?.[0]?.finishReason
  if (finish && BLOCKING_REASONS.has(finish))
    throw new LlmError(`Réponse interrompue par le filtre de Gemini (${finish}).`, 'gemini', { kind: 'blocked' })
}

export function toUsage(meta: GeminiResponse['usageMetadata']): LlmUsage {
  const cached = meta?.cachedContentTokenCount ?? 0
  return {
    inputTokens: Math.max(0, (meta?.promptTokenCount ?? 0) - cached),
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  }
}

/**
 * Découpe un flux SSE (« data: {...}\n\n ») en objets JSON.
 * Renvoie les événements complets et le reste du tampon à conserver.
 */
export function parseSseBuffer(buffer: string): { events: GeminiResponse[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const blocks = normalized.split('\n\n')
  const rest = blocks.pop() ?? ''
  const events: GeminiResponse[] = []
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data || data === '[DONE]') continue
    events.push(JSON.parse(data) as GeminiResponse)
  }
  return { events, rest }
}

/* ---------- Liste des modèles ---------- */

interface GeminiModel {
  name: string
  displayName?: string
  description?: string
  supportedGenerationMethods?: string[]
}

const EXCLUDED = /(embedding|tts|image|imagen|veo|live|audio|aqa|robotics|computer-use|native|transcribe|translate|banana|omni)/i

/**
 * Modèles de texte indiqués « Free of charge » sur https://ai.google.dev/gemini-api/docs/pricing
 * (relevé le 17/11/2026), du plus recommandé au moins recommandé. Cette liste peut évoluer :
 * elle ne sert qu'à proposer de bons choix par défaut et à signaler les modèles gratuits.
 */
export const GEMINI_FREE_STORY_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash']
export const GEMINI_FREE_UTILITY_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
const FREE_MODELS = new Set([...GEMINI_FREE_STORY_MODELS, ...GEMINI_FREE_UTILITY_MODELS])

export function isKnownFreeGeminiModel(id: string): boolean {
  return FREE_MODELS.has(id)
}

/** Garde uniquement les modèles de texte Gemini capables de générer une réponse. */
export function filterTextModels(models: GeminiModel[]): ModelOption[] {
  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({ ...m, id: m.name.replace(/^models\//, '') }))
    .filter((m) => /^gemini-\d/.test(m.id) && !EXCLUDED.test(m.id))
    .map((m) => ({
      id: m.id,
      label: (m.displayName ?? m.id) + (isKnownFreeGeminiModel(m.id) ? ' (gratuit)' : ''),
      hint: m.id,
    }))
    .sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }))
}

/**
 * Choisit des modèles par défaut : d'abord les modèles gratuits connus,
 * sinon un « Flash » pour l'histoire et un « Flash-Lite » pour les tâches internes.
 */
export function pickDefaultGeminiModels(options: ModelOption[]): { story?: string; utility?: string } {
  const ids = options.map((o) => o.id)
  const firstAvailable = (candidates: string[]) => candidates.find((c) => ids.includes(c))
  const stable = (id: string) => !/(preview|exp)/i.test(id)
  const byPattern = (pattern: RegExp) => ids.find((id) => pattern.test(id) && stable(id)) ?? ids.find((id) => pattern.test(id))

  const story = firstAvailable(GEMINI_FREE_STORY_MODELS) ?? byPattern(/flash(?!-lite)/i) ?? ids[0]
  const utility = firstAvailable(GEMINI_FREE_UTILITY_MODELS) ?? byPattern(/flash-lite/i) ?? story
  return { story, utility }
}

/* ---------- Appels réseau ---------- */

async function throwHttpError(response: Response): Promise<never> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string; status?: string } }
    detail = body.error?.message ?? body.error?.status ?? ''
  } catch {
    /* corps illisible : on garde le code HTTP */
  }
  throw new LlmError(detail || `HTTP ${response.status}`, 'gemini', { status: response.status })
}

/** Codes HTTP passagers (surcharge, quota par minute) : on réessaie avant d'abandonner. */
export const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/** Délai avant la tentative n° `attempt` (1, 2…) : 1 s, 3 s, 7 s. */
export function retryDelayMs(attempt: number): number {
  return (2 ** attempt - 1) * 1000
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

/**
 * fetch avec relances sur les erreurs passagères (avant tout envoi de texte à l'écran).
 * Une erreur « quota 0 » (modèle hors offre gratuite) n'est pas relancée : elle ne passera jamais.
 */
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init)
    if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt >= maxRetries) return response
    if (response.status === 429) {
      const body = await response.clone().text()
      if (/limit:\s*0\b/i.test(body)) return response
    }
    await wait(retryDelayMs(attempt + 1), init.signal ?? undefined)
  }
}

export function createGeminiProvider(apiKey: string): LlmProvider {
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }

  async function complete(request: LlmRequest): Promise<LlmResult> {
    const response = await fetchWithRetry(`${BASE_URL}/models/${encodeURIComponent(request.model)}:generateContent`, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildGeminiBody(request)),
      signal: request.signal,
    })
    if (!response.ok) await throwHttpError(response)
    const data = (await response.json()) as GeminiResponse
    assertNotBlocked(data)
    return { text: extractText(data), usage: toUsage(data.usageMetadata), costUsd: 0 }
  }

  async function stream(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult> {
    const response = await fetchWithRetry(
      `${BASE_URL}/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`,
      { method: 'POST', headers, body: JSON.stringify(buildGeminiBody(request)), signal: request.signal },
    )
    if (!response.ok) await throwHttpError(response)
    if (!response.body) throw new LlmError('Réponse vide de Gemini.', 'gemini', { kind: 'empty' })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    let lastUsage: GeminiResponse['usageMetadata']

    for (;;) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const { events, rest } = parseSseBuffer(done ? buffer + '\n\n' : buffer)
      buffer = rest
      for (const event of events) {
        assertNotBlocked(event)
        const delta = extractText(event)
        if (delta) {
          text += delta
          onText(delta)
        }
        if (event.usageMetadata) lastUsage = event.usageMetadata
      }
      if (done) break
    }
    return { text, usage: toUsage(lastUsage), costUsd: 0 }
  }

  async function listModels(): Promise<ModelOption[]> {
    const response = await fetch(`${BASE_URL}/models?pageSize=1000`, { headers: { 'x-goog-api-key': apiKey } })
    if (!response.ok) await throwHttpError(response)
    const data = (await response.json()) as { models?: GeminiModel[] }
    return filterTextModels(data.models ?? [])
  }

  return { id: 'gemini', complete, stream, listModels }
}
