/**
 * Import de cartes de personnages au format SillyTavern / Character Card (V1, V2 et V3).
 * - Fichier JSON : la carte directement.
 * - Fichier PNG : la carte est cachée dans un bloc texte « chara » (V2) ou « ccv3 » (V3), encodée en base64.
 * Spécification : https://github.com/malfoyslastname/character-card-spec-v2
 */

export interface CardData {
  name: string
  description: string
  personality: string
  scenario: string
  firstMessage: string
  alternateGreetings: string[]
  exampleDialogues: string
  systemPrompt: string
  postHistoryInstructions: string
  creatorNotes: string
  tags: string[]
  /** Entrées du « lorebook » intégré (clés + contenu). */
  lore: { keys: string[]; content: string }[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Lit une carte (V1 à plat, ou V2/V3 avec un objet `data`). Lève une erreur lisible si ce n'en est pas une. */
export function parseCharacterCard(json: unknown): CardData {
  if (typeof json !== 'object' || json === null) throw new Error("Ce fichier n'est pas une carte de personnage.")
  const root = json as Record<string, unknown>
  const d = (typeof root.data === 'object' && root.data !== null ? root.data : root) as Record<string, unknown>
  const name = str(d.name).trim()
  if (!name) throw new Error("Carte de personnage invalide : nom manquant.")

  const book = d.character_book as { entries?: unknown } | undefined
  const lore = Array.isArray(book?.entries)
    ? (book.entries as Record<string, unknown>[])
        .filter((e) => e && e.enabled !== false && str(e.content).trim())
        .map((e) => ({ keys: strList(e.keys), content: str(e.content).trim() }))
    : []

  return {
    name,
    description: str(d.description).trim(),
    personality: str(d.personality).trim(),
    scenario: str(d.scenario).trim(),
    firstMessage: str(d.first_mes).trim(),
    alternateGreetings: strList(d.alternate_greetings).map((g) => g.trim()).filter(Boolean),
    exampleDialogues: str(d.mes_example).trim(),
    systemPrompt: str(d.system_prompt).trim(),
    postHistoryInstructions: str(d.post_history_instructions).trim(),
    creatorNotes: str(d.creator_notes ?? root.creatorcomment).trim(),
    tags: strList(d.tags),
    lore,
  }
}

/** Décode du base64 en texte UTF-8 (fonctionne dans le navigateur et dans les tests). */
function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.replace(/\s+/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Décompresse des données zlib (blocs PNG zTXt / iTXt compressés). */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Extrait le JSON de la carte caché dans un PNG : bloc « ccv3 » (V3) de préférence, sinon « chara ».
 * Les blocs peuvent être en clair (tEXt), compressés (zTXt) ou internationaux (iTXt).
 */
export async function extractCardFromPng(bytes: Uint8Array): Promise<unknown | null> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 8 || signature.some((b, i) => bytes[i] !== b)) throw new Error("Ce fichier n'est pas une image PNG valide.")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const latin1 = new TextDecoder('latin1')
  const utf8 = new TextDecoder()
  const found: Record<string, string> = {}
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = latin1.decode(bytes.subarray(offset + 4, offset + 8))
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd > bytes.length) break
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const chunk = bytes.subarray(dataStart, dataEnd)
      const sep = chunk.indexOf(0)
      const keyword = sep > 0 ? latin1.decode(chunk.subarray(0, sep)).toLowerCase() : ''
      if ((keyword === 'chara' || keyword === 'ccv3') && !(keyword in found)) {
        if (type === 'tEXt') {
          found[keyword] = latin1.decode(chunk.subarray(sep + 1))
        } else if (type === 'zTXt') {
          // mot-clé \0 méthode(1 octet) données compressées
          found[keyword] = latin1.decode(await inflate(chunk.subarray(sep + 2)))
        } else {
          // iTXt : mot-clé \0 compressé(1) méthode(1) langue \0 mot-clé traduit \0 texte
          const compressed = chunk[sep + 1] === 1
          const langEnd = chunk.indexOf(0, sep + 3)
          const transEnd = chunk.indexOf(0, langEnd + 1)
          const text = chunk.subarray(transEnd + 1)
          found[keyword] = utf8.decode(compressed ? await inflate(text) : text)
        }
      }
    }
    if (type === 'IEND') break
    offset = dataEnd + 4 // + CRC
  }
  const raw = found.ccv3 ?? found.chara
  if (!raw) return null
  const trimmed = raw.trim()
  // Certains outils écrivent le JSON en clair plutôt qu'en base64.
  return JSON.parse(trimmed.startsWith('{') ? trimmed : decodeBase64Utf8(trimmed))
}

/** Remplace les variables SillyTavern ({{char}}, {{user}}, <BOT>, <USER>). */
export function substituteVariables(text: string, charName: string, userName: string): string {
  return text
    .replace(/\{\{\s*char\s*\}\}|<BOT>/gi, charName)
    .replace(/\{\{\s*user\s*\}\}|<USER>/gi, userName)
}

/**
 * Convertit un message d'accueil SillyTavern (*actions* et "répliques") au format narratif de DM :
 * paragraphe entre astérisques → 「narration」 ; paragraphe entre guillemets → Nom | "réplique".
 */
export function convertGreeting(text: string, charName: string): string {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const action = /^\*([^*]+)\*$/.exec(p)
      if (action) return `「${action[1].trim()}」`
      const speech = /^["“«]\s*([\s\S]+?)\s*["”»]$/.exec(p)
      if (speech) return `${charName} | "${speech[1]}"`
      // Paragraphe mixte : on garde le texte, sans les astérisques.
      return p.replace(/\*([^*]+)\*/g, '$1')
    })
    .join('\n')
}
