/**
 * Commandes de jeu (« / ») : intégrées (OOC, GrantAlias) ou définies par l'histoire.
 */

export interface StoryCommand {
  /** Nom sans la barre oblique, sans espace (« Flashback »). */
  name: string
  description: string
  /** Consigne envoyée à la narratrice quand le joueur utilise la commande. */
  instruction: string
}

export const BUILTIN_COMMANDS: { name: string; description: string }[] = [
  { name: 'OOC', description: "Parler à l'IA hors de l'histoire : corriger, demander un résumé, orienter la suite…" },
  { name: 'GrantAlias', description: 'Recevoir un nouveau surnom inspiré de tes actions.' },
]

export type ParsedCommand =
  | { kind: 'none'; text: string }
  | { kind: 'ooc'; text: string }
  | { kind: 'alias'; text: string }
  | { kind: 'custom'; command: StoryCommand; text: string }

/** Nom de commande valide : lettres, chiffres, tirets (sans espace ni barre oblique). */
export function cleanCommandName(name: string): string {
  return name
    .trim()
    .replace(/^\/+/, '')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 24)
}

/** Analyse la saisie du joueur (insensible à la casse). */
export function parseCommand(input: string, custom: StoryCommand[] = []): ParsedCommand {
  const trimmed = input.trim()
  const match = /^\/([\p{L}\p{N}_-]+)(?:\s+([\s\S]*))?$/u.exec(trimmed)
  if (!match) return { kind: 'none', text: trimmed }
  const name = match[1].toLowerCase()
  const text = (match[2] ?? '').trim()
  if (name === 'ooc') return { kind: 'ooc', text }
  if (name === 'grantalias') return { kind: 'alias', text }
  const command = custom.find((c) => c.name.toLowerCase() === name)
  if (command) return { kind: 'custom', command, text }
  return { kind: 'none', text: trimmed }
}

/** Texte envoyé à la narratrice pour un message qui utilise une commande personnalisée. */
export function expandCustomCommand(content: string, custom: StoryCommand[]): string {
  const parsed = parseCommand(content, custom)
  if (parsed.kind !== 'custom') return content
  return `[Commande /${parsed.command.name} : ${parsed.command.instruction.trim()}]${parsed.text ? `\n${parsed.text}` : ''}`
}
