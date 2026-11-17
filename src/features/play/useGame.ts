import { useCallback, useMemo, useRef, useState } from 'react'
import { applyMemoryChanges, loadMemories, useGlobalNotes, useMemories } from '../../data/memories'
import {
  addCostAndTurn,
  addVariant,
  appendMessage,
  deleteAfter,
  deleteFrom,
  loadSession,
  patchSession,
  selectVariant,
  setActiveContent,
  useSessionData,
} from '../../data/sessions'
import { useSettings } from '../../data/settings'
import { activeProvider, isReady } from '../../data/settingsModel'
import { createProvider } from '../../engine/llm/client'
import { describeLlmError } from '../../engine/llm/errors'
import { buildTurnAnalysisRequest, parseTurnAnalysis } from '../../engine/memory/analysis'
import { buildSummaryRequest, planSummary, summaryIndex } from '../../engine/memory/summary'
import { buildHistory, buildMemoryPrompt, buildSystemPrompt, CONTINUE_INSTRUCTION, HISTORY_CHAR_BUDGET, type StoryContext } from '../../engine/prompt/storyPrompt'
import { getThread, parseOocCommand, toEntries } from '../../engine/session/thread'
import type { Message, ThreadEntry } from '../../engine/session/types'

/** Longueur maximale d'une réponse de la narratrice (marge pour les modèles qui « réfléchissent »). */
const STORY_MAX_TOKENS = 2048

export type Streaming =
  | { mode: 'reply'; text: string }
  | { mode: 'regenerate'; messageId: string; text: string }
  | { mode: 'continue'; messageId: string; text: string }

type Retry = () => Promise<void>

/**
 * Logique d'une partie : envoi des actions, génération en streaming, régénération,
 * suite, modification et suppression des messages, actions suggérées.
 */
export function useGame(sessionId: string | undefined) {
  const data = useSessionData(sessionId)
  const settings = useSettings()
  const memories = useMemories(sessionId)
  const globalNotes = useGlobalNotes()
  const [streaming, setStreaming] = useState<Streaming | null>(null)
  const [error, setError] = useState<{ message: string; retry?: Retry } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const thread = useMemo(
    () => (data ? getThread(data.messages, data.session.activeLeafId) : []),
    [data],
  )
  const ready = settings ? isReady(settings) : false
  const busy = streaming !== null

  const context = useMemo<StoryContext | null>(() => {
    if (!data) return null
    return {
      title: data.story.title,
      worldLore: data.story.worldLore,
      systemPrompt: data.story.systemPrompt,
      writingRules: data.story.writingRules,
      characters: data.characters,
      avatar: data.session.avatar,
    }
  }, [data])

  /** Appel en streaming à la narratrice. `extra` = consigne ajoutée sans être enregistrée. */
  const generate = useCallback(
    async (entries: ThreadEntry[], onText: (text: string) => void, extra?: string) => {
      if (!settings || !context) throw new Error('Partie non chargée.')
      const active = activeProvider(settings)
      const covered = summaryIndex(entries, data?.session.summary)
      const messages = buildHistory(entries, HISTORY_CHAR_BUDGET, covered)
      if (extra) messages.push({ role: 'user', content: extra })
      const systemDynamic = buildMemoryPrompt({
        globalNotes: globalNotes ?? '',
        sessionNotes: data?.session.userNotes ?? '',
        memories: memories ?? [],
        summary: covered >= 1 ? (data?.session.summary?.text ?? '') : '',
      })
      const controller = new AbortController()
      abortRef.current = controller
      let text = ''
      const result = await createProvider(active.provider, active.apiKey).stream(
        {
          model: active.storyModel,
          system: buildSystemPrompt(context),
          systemDynamic,
          messages,
          maxTokens: STORY_MAX_TOKENS,
          signal: controller.signal,
          cacheSystem: true,
        },
        (delta) => {
          text += delta
          onText(text)
        },
      )
      if (!result.text.trim()) throw new Error("L'IA a renvoyé une réponse vide. Réessaie.")
      return { ...result, model: active.storyModel }
    },
    [settings, context, data, memories, globalNotes],
  )

  /**
   * Fin de tour (modèle « tâches internes ») : actions suggérées + mise à jour de la mémoire,
   * puis résumé des échanges anciens si la partie devient longue.
   * Ces étapes sont un confort : un échec n'interrompt jamais la partie.
   */
  const refreshSuggestions = useCallback(
    async (entries: ThreadEntry[]) => {
      if (!settings || !data) return
      const active = activeProvider(settings)
      const provider = createProvider(active.provider, active.apiKey)
      const sessionId = data.session.id
      const playerName = data.session.avatar?.name || 'le joueur'
      setSuggesting(true)
      try {
        const auto = (await loadMemories(sessionId)).filter((m) => m.kind !== 'long')
        const result = await provider.complete(buildTurnAnalysisRequest(active.utilityModel, playerName, entries, auto))
        const analysis = parseTurnAnalysis(result.text, auto)
        await patchSession(sessionId, { suggestions: analysis.suggestions })
        await applyMemoryChanges(sessionId, analysis)
        if (result.costUsd) await addCostAndTurn(sessionId, result.costUsd)
      } catch {
        /* suggestions et mémoire facultatives */
      } finally {
        setSuggesting(false)
      }

      try {
        const fresh = await loadSession(sessionId)
        const plan = planSummary(entries, fresh?.summary)
        if (!plan) return
        const result = await provider.complete(buildSummaryRequest(active.utilityModel, playerName, plan.base, plan.toSummarize))
        if (result.text.trim())
          await patchSession(sessionId, { summary: { text: result.text.trim(), coversUntilId: plan.coversUntilId, updatedAt: Date.now() } })
        if (result.costUsd) await addCostAndTurn(sessionId, result.costUsd)
      } catch {
        /* on réessaiera au prochain tour */
      }
    },
    [settings, data],
  )

  const fail = (err: unknown, retry?: Retry) => {
    const message = describeLlmError(err)
    // Une interruption volontaire n'est pas une erreur à afficher.
    if (message === 'Génération interrompue.') return
    setError({ message, retry })
  }

  /** Fait répondre la narratrice au message `userMessage` (dernier message du fil). */
  const replyTo = useCallback(
    async (userMessage: Message, entries: ThreadEntry[]) => {
      if (!data) return
      setError(null)
      setStreaming({ mode: 'reply', text: '' })
      try {
        const result = await generate(entries, (text) => setStreaming({ mode: 'reply', text }))
        const ai = await appendMessage(
          data.session,
          'ai',
          { content: result.text.trim(), createdAt: Date.now(), model: result.model, costUsd: result.costUsd },
          { ooc: userMessage.ooc, parentId: userMessage.id },
        )
        await addCostAndTurn(data.session.id, result.costUsd, userMessage.ooc ? 0 : 1)
        setStreaming(null)
        if (!userMessage.ooc)
          void refreshSuggestions([...entries, { id: ai.id, role: 'ai', ooc: false, content: result.text.trim() }])
      } catch (err) {
        setStreaming(null)
        fail(err, () => replyTo(userMessage, entries))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, generate, refreshSuggestions],
  )

  const send = useCallback(
    async (input: string) => {
      if (!data || busy) return
      const { ooc, text } = parseOocCommand(input)
      if (!text) return
      const leaf = thread[thread.length - 1]
      const user = await appendMessage(data.session, 'user', { content: text, createdAt: Date.now() }, { ooc, parentId: leaf?.id ?? null })
      await patchSession(data.session.id, { suggestions: [] })
      await replyTo(user, [...toEntries(thread), { id: user.id, role: 'user', ooc, content: text }])
    },
    [data, busy, thread, replyTo],
  )

  const regenerate = useCallback(
    async (message: Message) => {
      if (!data || busy || message.role !== 'ai' || message.parentId === null) return
      const index = thread.findIndex((m) => m.id === message.id)
      if (index < 0) return
      const entries = toEntries(thread.slice(0, index))
      setError(null)
      setStreaming({ mode: 'regenerate', messageId: message.id, text: '' })
      try {
        const result = await generate(entries, (text) => setStreaming({ mode: 'regenerate', messageId: message.id, text }))
        await addVariant(message.id, { content: result.text.trim(), createdAt: Date.now(), model: result.model, costUsd: result.costUsd })
        await addCostAndTurn(data.session.id, result.costUsd)
        setStreaming(null)
        if (index === thread.length - 1 && !message.ooc)
          void refreshSuggestions([...entries, { id: message.id, role: 'ai', ooc: false, content: result.text.trim() }])
      } catch (err) {
        setStreaming(null)
        fail(err, () => regenerate(message))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, busy, thread, generate, refreshSuggestions],
  )

  const continueMessage = useCallback(
    async (message: Message) => {
      if (!data || busy || message.role !== 'ai') return
      const index = thread.findIndex((m) => m.id === message.id)
      if (index < 0) return
      const entries = toEntries(thread.slice(0, index + 1))
      const before = entries[entries.length - 1].content
      setError(null)
      setStreaming({ mode: 'continue', messageId: message.id, text: '' })
      try {
        const result = await generate(
          entries,
          (text) => setStreaming({ mode: 'continue', messageId: message.id, text }),
          CONTINUE_INSTRUCTION,
        )
        await setActiveContent(message.id, `${before}\n${result.text.trim()}`, result.costUsd)
        await addCostAndTurn(data.session.id, result.costUsd)
        setStreaming(null)
      } catch (err) {
        setStreaming(null)
        fail(err, () => continueMessage(message))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, busy, thread, generate],
  )

  /** Modifie un message. Pour un message du joueur, la suite est effacée et la narratrice répond à nouveau. */
  const editMessage = useCallback(
    async (message: Message, content: string) => {
      if (!data || busy) return
      const text = content.trim()
      if (!text) return
      await setActiveContent(message.id, text)
      if (message.role === 'ai') return
      await deleteAfter(data.session, message.id)
      const index = thread.findIndex((m) => m.id === message.id)
      const entries = [...toEntries(thread.slice(0, index)), { id: message.id, role: 'user' as const, ooc: !!message.ooc, content: text }]
      await replyTo({ ...message }, entries)
    },
    [data, busy, thread, replyTo],
  )

  const deleteMessage = useCallback(
    async (message: Message) => {
      if (!data || busy) return
      setError(null)
      await deleteFrom(data.session, message.id)
    },
    [data, busy],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  return {
    data,
    thread,
    ready,
    busy,
    streaming,
    error,
    suggesting,
    dismissError: () => setError(null),
    send,
    regenerate,
    continueMessage,
    editMessage,
    deleteMessage,
    selectVariant,
    stop,
  }
}
