/**
 * Import de cartes de personnages par lien (v0.9.4), sur le modèle de « Import from URL » de SillyTavern.
 * Seuls les sites qui proposent publiquement le téléchargement de leurs cartes sont pris en charge.
 * L'application n'a pas de serveur : chaque site doit accepter les requêtes venant d'une page web (CORS),
 * sinon l'import échoue proprement et on invite à télécharger le fichier.
 */

export type CardSite = 'chub' | 'risu' | 'pygmalion' | 'aicc' | 'ctavern'

export interface CardSource {
  site: CardSite
  id: string
}

export const CARD_SITES: Record<CardSite, string> = {
  chub: 'Chub (chub.ai)',
  risu: 'RisuAI Realm',
  pygmalion: 'Pygmalion',
  aicc: 'AICharacterCards',
  ctavern: 'Character Tavern',
}

const UUID = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i

/** Reconnaît un lien de carte. Renvoie null pour un lien d'un autre site ou mal formé. */
export function parseCardUrl(input: string): CardSource | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)

  if (host.endsWith('chub.ai') || host.endsWith('characterhub.org')) {
    // chub.ai/characters/auteur/projet  (ou chub.ai/auteur/projet)
    const rest = parts[0] === 'characters' ? parts.slice(1) : parts
    if (rest[0] === 'lorebooks' || rest.length < 2) return null
    return { site: 'chub', id: `${rest[0]}/${rest[1]}` }
  }
  if (host === 'realm.risuai.net') {
    const m = UUID.exec(url.pathname)
    return parts[0] === 'character' && m ? { site: 'risu', id: m[0].toLowerCase() } : null
  }
  if (host.endsWith('pygmalion.chat')) {
    const m = UUID.exec(url.pathname)
    return m ? { site: 'pygmalion', id: m[0].toLowerCase() } : null
  }
  if (host.endsWith('character-tavern.com')) {
    // character-tavern.com/character/auteur/carte
    return parts[0] === 'character' && parts.length >= 3 ? { site: 'ctavern', id: `${parts[1]}/${parts[2]}` } : null
  }
  if (host.endsWith('aicharactercards.com')) {
    const i = parts.indexOf('character-cards')
    return i >= 0 && parts.length >= i + 3 ? { site: 'aicc', id: `${parts[i + 1]}/${parts[i + 2]}` } : null
  }
  return null
}

/** Ce qu'il faut télécharger pour une carte. */
export type CardRequest =
  | { kind: 'png'; url: string }
  | { kind: 'chub-json'; url: string }
  | { kind: 'pygmalion-json'; url: string }

export function cardRequest(source: CardSource): CardRequest {
  switch (source.site) {
    case 'chub':
      return { kind: 'chub-json', url: `https://api.chub.ai/api/characters/${source.id.split('/').map(encodeURIComponent).join('/')}?full=true` }
    case 'risu':
      return { kind: 'png', url: `https://realm.risuai.net/api/v1/download/png-v3/${source.id}?non_commercial=true` }
    case 'pygmalion':
      return { kind: 'pygmalion-json', url: `https://server.pygmalion.chat/api/export/character/${source.id}/v2` }
    case 'ctavern':
      // Même fichier que le bouton « Download » de la page de la carte.
      return { kind: 'png', url: `https://ct-cards.storage.character-tavern.com/${source.id.split('/').map(encodeURIComponent).join('/')}.png?action=download` }
    case 'aicc':
      return { kind: 'png', url: `https://aicharactercards.com/wp-json/pngapi/v1/image/${source.id.split('/').map(encodeURIComponent).join('/')}` }
  }
}

const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Réponse de l'API Chub → carte V2 (même correspondance que SillyTavern) + adresse de l'image. */
export function chubToCard(json: unknown): { card: unknown; imageUrl?: string } {
  const node = obj(obj(json).node)
  const def = obj(node.definition)
  const name = str(def.name) || str(node.name)
  if (!name) throw new Error("Chub n'a pas renvoyé de personnage (carte privée, supprimée ou réservée aux comptes connectés ?).")
  return {
    card: {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name,
        // Chez Chub, « personality » contient la description complète du personnage.
        description: str(def.personality),
        personality: str(def.tavern_personality),
        scenario: str(def.scenario),
        first_mes: str(def.first_message),
        mes_example: str(def.example_dialogs),
        system_prompt: str(def.system_prompt),
        post_history_instructions: str(def.post_history_instructions),
        alternate_greetings: Array.isArray(def.alternate_greetings) ? def.alternate_greetings : [],
        creator_notes: str(def.description) || str(node.tagline),
        tags: Array.isArray(node.topics) ? node.topics : [],
        character_book: def.embedded_lorebook ?? undefined,
      },
    },
    imageUrl: str(node.max_res_url) || str(node.avatar_url) || undefined,
  }
}

/** Réponse de l'export Pygmalion → carte + adresse de l'image. */
export function pygmalionToCard(json: unknown): { card: unknown; imageUrl?: string } {
  const character = obj(json).character
  if (!character) throw new Error("Pygmalion n'a pas renvoyé de personnage.")
  return { card: character, imageUrl: str(obj(obj(character).data).avatar) || undefined }
}

/** Sépare une saisie en liens (un par ligne, ou séparés par des espaces). */
export function splitLinks(text: string): string[] {
  return [...new Set(text.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s)))]
}
