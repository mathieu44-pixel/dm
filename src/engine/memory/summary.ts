import type { LlmRequest } from '../llm/types'
import type { ThreadEntry } from '../session/types'
import type { SessionSummary } from './types'

/**
 * Résumé glissant : quand la partie s'allonge, les échanges anciens sont résumés
 * puis retirés du contexte. La narratrice garde le fil sans que le coût explose.
 */

/** Taille (en caractères) des échanges non résumés au-delà de laquelle on résume. */
export const SUMMARY_TRIGGER_CHARS = 24_000
/** Nombre de derniers messages toujours envoyés tels quels. */
export const KEEP_RECENT_ENTRIES = 10

/** Index du dernier message couvert par le résumé dans le fil actuel (-1 si aucun ou si le fil a changé). */
export function summaryIndex(entries: ThreadEntry[], summary: SessionSummary | undefined): number {
  if (!summary) return -1
  return entries.findIndex((e) => e.id === summary.coversUntilId)
}

/**
 * Faut-il résumer ? Renvoie les messages à intégrer au résumé, ou null.
 * Le prologue (index 0) est toujours conservé tel quel.
 */
export function planSummary(
  entries: ThreadEntry[],
  summary: SessionSummary | undefined,
  trigger = SUMMARY_TRIGGER_CHARS,
  keepRecent = KEEP_RECENT_ENTRIES,
): { toSummarize: ThreadEntry[]; coversUntilId: string; base: string } | null {
  const covered = summaryIndex(entries, summary)
  const from = Math.max(1, covered + 1)
  const pending = entries.slice(from)
  const size = pending.reduce((n, e) => n + e.content.length, 0)
  if (size < trigger || pending.length <= keepRecent) return null
  const toSummarize = pending.slice(0, pending.length - keepRecent).filter((e) => !e.ooc)
  if (toSummarize.length === 0) return null
  return {
    toSummarize,
    coversUntilId: pending[pending.length - keepRecent - 1].id,
    // Si le fil a changé (message modifié avant le résumé), on repart de zéro.
    base: covered >= 0 && summary ? summary.text : '',
  }
}

export function buildSummaryRequest(model: string, playerName: string, previous: string, entries: ThreadEntry[]): LlmRequest {
  const transcript = entries
    .map((e) => `${e.role === 'user' ? `JOUEUR (${playerName})` : 'NARRATRICE'} :\n${e.content}`)
    .join('\n\n')
  return {
    model,
    maxTokens: 2048,
    temperature: 0.3,
    system: "Tu résumes une histoire interactive pour qu'une narratrice puisse la poursuivre sans rien oublier d'important.",
    messages: [
      {
        role: 'user',
        content: [
          previous ? `Résumé existant :\n${previous}` : 'Pas encore de résumé.',
          '',
          `Nouveaux échanges à intégrer :\n\n${transcript}`,
          '',
          `Écris le résumé complet mis à jour, en français, au passé, à la troisième personne (${playerName} est le personnage du joueur).`,
          "Garde : événements clés dans l'ordre, décisions du joueur, révélations, promesses, objets importants, état des relations, lieux visités.",
          'Sois factuel et concis (400 mots maximum). Réponds uniquement par le résumé.',
        ].join('\n'),
      },
    ],
  }
}
