import { useCallback, useMemo, useRef, useState } from 'react'
import { loadSceneImages } from '../../data/images'
import { applyMemoryChanges, loadMemories, useGlobalNotes, useMemories } from '../../data/memories'
import {
  addVariant,
  appendMessage,
  deleteAfter,
  deleteFrom,
  loadSession,
  patchSession,
  selectVariant,
  setActiveContent,
  setSceneImage,
  useSessionData,
} from '../../data/sessions'
import { useSettings } from '../../data/settings'
import { activeProvider, isReady } from '../../data/settingsModel'
import { createProvider } from '../../engine/llm/client'
import { recordCost } from '../../data/costs'
import { describeLlmError } from '../../engine/llm/errors'
import { buildTurnAnalysisRequest, parseTurnAnalysis } from '../../engine/memory/analysis'
import { affinityLines, applyAffinityDeltas, meetCharacters } from '../../engine/relations/affinity'
import { buildSummaryRequest, planSummary, summaryIndex } from '../../engine/memory/summary'
import { applyDeltas, describeStat, findTriggeredEnding, initStats } from '../../engine/progression/rules'
import { formatLore, selectLore } from '../../engine/lore/lore'
import { buildHistory, buildMemoryPrompt, buildSystemPrompt, CONTINUE_INSTRUCTION, HISTORY_CHAR_BUDGET, type StoryContext } from '../../engine/prompt/storyPrompt'
import { parseNarrative } from '../../engine/parser/narrative'
import { sanitizeNarration } from '../../engine/parser/sanitize'
import { buildAliasRequest, parseAlias } from '../../engine/prompt/alias'
import { parseCommand } from '../../engine/session/commands'
import { languageInstruction, lengthOption, styleInstruction } from '../../engine/session/options'
import { deepestLeaf, getThread, joinContinuation, siblingsOf, toEntries } from '../../engine/session/thread'
import { findPortrait } from '../../ui/NarrativeView'
import type { Message, ThreadEntry } from '../../engine/session/types'

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

  const startSetting = useMemo(
    () => data?.story.startSettings.find((s) => s.id === data.session.startSettingId) ?? data?.story.startSettings[0],
    [data],
  )
  const statDefs = useMemo(() => startSetting?.stats ?? [], [startSetting])
  const endings = useMemo(() => startSetting?.endings ?? [], [startSetting])
  const statValues = useMemo(() => initStats(statDefs, data?.session.stats), [statDefs, data])

  const context = useMemo<StoryContext | null>(() => {
    if (!data) return null
    return {
      title: data.story.title,
      worldLore: data.story.worldLore,
      systemPrompt: data.story.systemPrompt,
      writingRules: data.story.writingRules,
      characters: data.characters,
      avatar: data.session.avatar,
      statDefs,
      commands: data.story.commands ?? [],
      mode: data.story.mode,
    }
  }, [data, statDefs])

  /** Appel en streaming à la narratrice. `extra` = consigne ajoutée sans être enregistrée. */
  const generate = useCallback(
    async (entries: ThreadEntry[], onText: (text: string) => void, extra?: string) => {
      if (!settings || !context) throw new Error('Partie non chargée.')
      const active = activeProvider(settings)
      const covered = summaryIndex(entries, data?.session.summary)
      const messages = buildHistory(entries, HISTORY_CHAR_BUDGET, covered, data?.story.commands ?? [])
      const session = data?.session
      const length = lengthOption(session?.length)
      if (extra) messages.push({ role: 'user', content: extra })
      const systemDynamic = buildMemoryPrompt({
        globalNotes: globalNotes ?? '',
        sessionNotes: data?.session.userNotes ?? '',
        memories: memories ?? [],
        summary: covered >= 1 ? (data?.session.summary?.text ?? '') : '',
        statLines: statDefs.map((d) => describeStat(d, statValues[d.id])),
        affinityLines: affinityLines(session?.affinities, data?.characters ?? []),
        language: languageInstruction(session?.language),
        length: length.instruction,
        style: styleInstruction(session?.writingStyle, session?.customStyle),
        aliases: session?.aliases ?? [],
        lore: formatLore(selectLore(data?.story.lore, [...entries.map((e) => e.content), extra ?? ''])),
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
          maxTokens: length.maxTokens,
          signal: controller.signal,
          cacheSystem: true,
          cacheHistory: true,
        },
        (delta) => {
          text += delta
          onText(text)
        },
      )
      if (!result.text.trim()) throw new Error("L'IA a renvoyé une réponse vide. Réessaie.")
      return { ...result, model: active.storyModel }
    },
    [settings, context, data, memories, globalNotes, statDefs, statValues],
  )

  /** Vérifie si une fin est atteinte (règles déterministes, sans appel à l'IA). */
  const checkEnding = useCallback(
    async (sessionId: string, stats: Record<string, number>) => {
      if (!endings.length) return
      const fresh = await loadSession(sessionId)
      if (!fresh || fresh.pendingEndingId) return
      const reached = fresh.endingsReached ?? []
      const ending = findTriggeredEnding(endings, { turn: fresh.turn, stats }, reached)
      if (!ending) return
      await patchSession(sessionId, {
        pendingEndingId: ending.id,
        endingsReached: [...reached, { endingId: ending.id, turn: fresh.turn, reachedAt: Date.now() }],
      })
    },
    [endings],
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
        const before = await loadSession(sessionId)
        const values = initStats(statDefs, before?.stats)
        // Personnages apparus dans les derniers messages (prologue compris au premier tour) : rencontrés à 50.
        const met = meetCharacters(before?.affinities, data.characters, entries.slice(-3).map((e) => e.content).join('\n'))
        const relations = data.characters.filter((c) => c.id in met).map((c) => ({ id: c.id, name: c.name, value: met[c.id] }))
        // Les images de personnage portent le nom du personnage dont elles sont le portrait.
        const portraits = Object.fromEntries(
          data.characters.filter((c) => c.portraitImageId).map((c) => [c.name, c.portraitImageId as string]),
        )
        const sceneImages = (await loadSceneImages(data.story.id)).map((img) => {
          const owners = data.characters.filter((c) => c.portraitImageId === img.id).map((c) => c.name)
          return owners.length ? { ...img, tags: [...owners, ...img.tags] } : img
        })
        const result = await provider.complete(
          buildTurnAnalysisRequest(
            active.utilityModel,
            playerName,
            entries,
            auto,
            statDefs.length ? { defs: statDefs, values } : undefined,
            sceneImages,
            data.session.language ?? 'fr',
            relations,
          ),
        )
        const analysis = parseTurnAnalysis(result.text, auto, statDefs, sceneImages, relations.map((r) => r.id))
        const last = entries[entries.length - 1]
        // Sans choix de l'IA : portrait du premier personnage qui parle dans le passage (comme dans OOC).
        const fallback =
          last?.role === 'ai'
            ? parseNarrative(last.content)
                .flatMap((seg) => (seg.type === 'dialogue' ? [findPortrait(seg.speaker, portraits)] : []))
                .find((id): id is string => !!id)
            : undefined
        const imageId = analysis.imageId ?? fallback
        if (imageId && last?.role === 'ai') await setSceneImage(sessionId, entries.map((e) => e.id), last.id, imageId)
        const nextStats = applyDeltas(statDefs, values, analysis.statDeltas)
        await patchSession(sessionId, {
          suggestions: analysis.suggestions,
          stats: nextStats,
          affinities: applyAffinityDeltas(met, analysis.affinityDeltas),
        })
        await applyMemoryChanges(sessionId, analysis)
        await recordCost(sessionId, 'analysis', result)
        await checkEnding(sessionId, nextStats)
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
        await recordCost(sessionId, 'summary', result)
      } catch {
        /* on réessaiera au prochain tour */
      }
    },
    [settings, data, statDefs, checkEnding],
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
        const content = userMessage.ooc ? result.text.trim() : sanitizeNarration(result.text)
        const ai = await appendMessage(
          data.session,
          'ai',
          { content, createdAt: Date.now(), model: result.model, costUsd: result.costUsd, ...(result.truncated ? { truncated: true } : {}) },
          { ooc: userMessage.ooc, parentId: userMessage.id },
        )
        await recordCost(data.session.id, 'story', result, userMessage.ooc ? 0 : 1)
        setStreaming(null)
        if (!userMessage.ooc)
          void refreshSuggestions([...entries, { id: ai.id, role: 'ai', ooc: false, content }])
      } catch (err) {
        setStreaming(null)
        fail(err, () => replyTo(userMessage, entries))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, generate, refreshSuggestions],
  )

  /** Commande /GrantAlias : un nouveau surnom pour le personnage du joueur. */
  const grantAlias = useCallback(async () => {
    if (!data || !settings) return
    const active = activeProvider(settings)
    const leaf = thread[thread.length - 1]
    const user = await appendMessage(data.session, 'user', { content: '/GrantAlias', createdAt: Date.now() }, { ooc: true, parentId: leaf?.id ?? null })
    setError(null)
    setStreaming({ mode: 'reply', text: '' })
    try {
      const existing = data.session.aliases ?? []
      const result = await createProvider(active.provider, active.apiKey).complete(
        buildAliasRequest(active.utilityModel, data.session.avatar?.name || 'le joueur', toEntries(thread), existing, data.session.language),
      )
      const alias = parseAlias(result.text)
      if (!alias) throw new Error("L'IA n'a pas proposé de surnom exploitable. Réessaie.")
      const text = `Nouveau surnom : « ${alias.alias} »${alias.reason ? `\n${alias.reason}` : ''}`
      await appendMessage(data.session, 'ai', { content: text, createdAt: Date.now(), model: active.utilityModel, costUsd: result.costUsd }, { ooc: true, parentId: user.id })
      await patchSession(data.session.id, { aliases: [...existing, alias.alias] })
      await recordCost(data.session.id, 'command', result)
    } catch (err) {
      fail(err)
    } finally {
      setStreaming(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, settings, thread])

  const send = useCallback(
    async (input: string) => {
      if (!data || busy) return
      const command = parseCommand(input, data.story.commands ?? [])
      if (command.kind === 'alias') return grantAlias()
      const ooc = command.kind === 'ooc'
      // Une commande personnalisée est enregistrée telle quelle (« /Flashback … ») et développée à l'envoi.
      const text = command.kind === 'custom' ? input.trim() : command.text
      if (!text) return
      const leaf = thread[thread.length - 1]
      const user = await appendMessage(data.session, 'user', { content: text, createdAt: Date.now() }, { ooc, parentId: leaf?.id ?? null })
      await patchSession(data.session.id, { suggestions: [] })
      await replyTo(user, [...toEntries(thread), { id: user.id, role: 'user', ooc, content: text }])
    },
    [data, busy, thread, replyTo, grantAlias],
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
        const content = message.ooc ? result.text.trim() : sanitizeNarration(result.text)
        await addVariant(message.id, { content, createdAt: Date.now(), model: result.model, costUsd: result.costUsd, ...(result.truncated ? { truncated: true } : {}) })
        await recordCost(data.session.id, 'story', result)
        setStreaming(null)
        if (index === thread.length - 1 && !message.ooc)
          void refreshSuggestions([...entries, { id: message.id, role: 'ai', ooc: false, content }])
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
        await setActiveContent(message.id, joinContinuation(before, message.ooc ? result.text.trim() : sanitizeNarration(result.text)), result.costUsd, !!result.truncated)
        await recordCost(data.session.id, 'story', result)
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

  /** Repart d'un message passé : la suite actuelle est conservée et reste accessible comme une autre branche. */
  const branchFrom = useCallback(
    async (message: Message) => {
      if (!data || busy) return
      await patchSession(data.session.id, { activeLeafId: message.id, suggestions: [] })
    },
    [data, busy],
  )

  /** Passe à la branche voisine (précédente ou suivante) d'un message. */
  const switchBranch = useCallback(
    async (message: Message, direction: -1 | 1) => {
      if (!data || busy) return
      const siblings = siblingsOf(data.messages, message)
      const target = siblings[siblings.findIndex((m) => m.id === message.id) + direction]
      if (!target) return
      await patchSession(data.session.id, { activeLeafId: deepestLeaf(data.messages, target.id), suggestions: [] })
    },
    [data, busy],
  )

  const branchInfo = useCallback(
    (message: Message) => {
      if (!data) return { index: 0, count: 1 }
      const siblings = siblingsOf(data.messages, message)
      return { index: siblings.findIndex((m) => m.id === message.id), count: siblings.length }
    },
    [data],
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
    statDefs,
    statValues,
    endings,
    dismissEnding: () => (data ? patchSession(data.session.id, { pendingEndingId: undefined }) : Promise.resolve()),
    send,
    regenerate,
    continueMessage,
    editMessage,
    deleteMessage,
    selectVariant,
    branchFrom,
    switchBranch,
    branchInfo,
    stop,
  }
}
