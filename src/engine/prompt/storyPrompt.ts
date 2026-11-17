import type { ChatMessage } from '../llm/types'
import { MEMORY_LABELS, type MemoryEntry } from '../memory/types'
import type { AvatarSnapshot, ThreadEntry } from '../session/types'

/**
 * Assemblage du prompt envoyé à l'IA à chaque tour.
 * Ordre : du plus stable (règles, univers, personnages) au plus variable (historique),
 * pour profiter au maximum du cache des fournisseurs.
 */

export interface PromptCharacter {
  name: string
  title: string
  appearance: string
  personality: string
  speech: string
  background: string
}

export interface StoryContext {
  title: string
  worldLore: string
  systemPrompt: string
  writingRules: string
  characters: PromptCharacter[]
  avatar: AvatarSnapshot | null
}

/** Marqueurs hors-jeu insérés dans l'historique envoyé à l'IA. */
export const OOC_PREFIX = '[Hors-jeu]'
const START_MARKER = '[La partie commence. Présente la scène d\'ouverture.]'

/** Budget de l'historique (en caractères) en attendant les résumés automatiques (v0.3). */
export const HISTORY_CHAR_BUDGET = 60_000

function section(title: string, body: string): string {
  const text = body.trim()
  return text ? `## ${title}\n${text}` : ''
}

export function describeCharacter(c: PromptCharacter): string {
  const lines = [
    `### ${c.name}${c.title ? ` — ${c.title}` : ''}`,
    c.appearance && `Apparence : ${c.appearance}`,
    c.personality && `Personnalité : ${c.personality}`,
    c.speech && `Façon de parler : ${c.speech}`,
    c.background && `Histoire et secrets (connus de toi seule, à révéler progressivement) : ${c.background}`,
  ]
  return lines.filter(Boolean).join('\n')
}

export function formatRules(playerName: string): string {
  return [
    "Tu es la narratrice d'une histoire interactive écrite en français. Tu décris le monde et tu fais vivre tous les personnages non joueurs.",
    `Le joueur incarne ${playerName}. Tu t'adresses à lui à la deuxième personne (« tu »).`,
    '',
    'Format obligatoire de tes réponses :',
    '- La narration est écrite entre 「 et 」 (un paragraphe par bloc).',
    '- Chaque réplique d\'un personnage est sur sa propre ligne, au format : Nom | "réplique"',
    '- N\'utilise ni titres, ni listes, ni choix numérotés, ni gras.',
    '',
    'Règles :',
    `- N'écris jamais les paroles, les pensées ou les décisions de ${playerName} : c'est le joueur qui les écrit.`,
    "- Le joueur écrit ses actions entre *astérisques* et ses paroles en texte simple. Décris les conséquences de ses actions de façon crédible.",
    '- Termine chaque réponse sur une situation ouverte qui invite le joueur à agir.',
    '- Reste cohérente avec l\'univers, les personnages et tout ce qui s\'est déjà passé.',
    `- Si un message du joueur commence par ${OOC_PREFIX}, il te parle hors de l'histoire : réponds brièvement, en tant qu'assistante, sans le format narratif et sans faire avancer l'histoire.`,
  ].join('\n')
}

export function buildSystemPrompt(ctx: StoryContext): string {
  const playerName = ctx.avatar?.name.trim() || 'le personnage du joueur'
  const avatar = ctx.avatar
    ? [
        `Nom : ${ctx.avatar.name}`,
        ctx.avatar.details && `Ce que l'on sait de lui/elle : ${ctx.avatar.details}`,
        ctx.avatar.gift && `Don : ${ctx.avatar.gift}`,
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return [
    formatRules(playerName),
    section(`Histoire : ${ctx.title}`, ''),
    section('Univers', ctx.worldLore),
    section('Consignes de l\'autrice', ctx.systemPrompt),
    section("Style d'écriture", ctx.writingRules),
    section('Personnages', ctx.characters.map(describeCharacter).join('\n\n')),
    section('Personnage du joueur', avatar),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface MemoryContext {
  globalNotes: string
  sessionNotes: string
  memories: MemoryEntry[]
  summary: string
}

/**
 * Partie variable des consignes (notes, mémoire, résumé), envoyée après la partie stable
 * pour ne pas casser le cache à chaque tour.
 */
export function buildMemoryPrompt(memory: MemoryContext): string {
  const notes = [memory.globalNotes.trim(), memory.sessionNotes.trim()].filter(Boolean).join('\n\n')
  const longTerm = memory.memories.filter((m) => m.kind === 'long')
  const auto = memory.memories.filter((m) => m.kind !== 'long')
  const order = { relation: 0, goal: 1, fact: 2, long: 3 } as const
  auto.sort((a, b) => order[a.kind] - order[b.kind] || a.createdAt - b.createdAt)

  return [
    section('Notes du joueur (à respecter en priorité)', notes),
    section('Souvenirs importants', longTerm.map((m) => `- ${m.text}`).join('\n')),
    section('Mémoire de la partie', auto.map((m) => `- ${MEMORY_LABELS[m.kind]} : ${m.text}`).join('\n')),
    section("Résumé de l'histoire jusqu'ici", memory.summary),
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Ajoute les messages en fusionnant deux messages consécutifs du même rôle (exigé par les API). */
function pushMerged(messages: ChatMessage[], message: ChatMessage) {
  const last = messages[messages.length - 1]
  if (last && last.role === message.role) last.content = `${last.content}\n\n${message.content}`
  else messages.push({ ...message })
}

export function entryToMessage(entry: ThreadEntry): ChatMessage {
  const role = entry.role === 'user' ? 'user' : 'assistant'
  return { role, content: entry.ooc ? `${OOC_PREFIX} ${entry.content}` : entry.content }
}

/**
 * Historique envoyé à l'IA. Le prologue (premier message de l'IA) est précédé d'un message
 * « la partie commence » car les API exigent de commencer par l'utilisateur.
 * Au-delà du budget, les messages les plus anciens (hors prologue) sont retirés.
 */
export function buildHistory(entries: ThreadEntry[], budget = HISTORY_CHAR_BUDGET, summarizedUntil = -1): ChatMessage[] {
  if (entries.length === 0) return [{ role: 'user', content: START_MARKER }]

  const [first, ...others] = entries
  const head: ChatMessage[] = [{ role: 'user', content: START_MARKER }]
  pushMerged(head, entryToMessage(first))

  // Les messages couverts par le résumé (index 1 à summarizedUntil) ne sont pas renvoyés.
  const rest = summarizedUntil >= 1 ? others.slice(summarizedUntil) : others
  if (summarizedUntil >= 1)
    pushMerged(head, { role: 'user', content: '[La suite de la partie, jusqu\'aux derniers échanges, est résumée dans tes consignes.]' })

  // On garde les messages les plus récents qui tiennent dans le budget.
  let used = head.reduce((n, m) => n + m.content.length, 0)
  const kept: ThreadEntry[] = []
  for (let i = rest.length - 1; i >= 0; i--) {
    used += rest[i].content.length
    if (used > budget && kept.length > 0) break
    kept.unshift(rest[i])
  }
  const skipped = rest.length - kept.length

  const messages = head
  if (skipped > 0) pushMerged(messages, { role: 'user', content: `[${skipped} messages plus anciens ont été omis.]` })
  for (const entry of kept) pushMerged(messages, entryToMessage(entry))
  return messages
}

/** Consigne ajoutée (sans être enregistrée) pour prolonger la dernière réponse. */
export const CONTINUE_INSTRUCTION =
  `${OOC_PREFIX} Poursuis ta dernière réponse exactement là où elle s'est arrêtée, sans la répéter ni la résumer, en respectant le format narratif.`
