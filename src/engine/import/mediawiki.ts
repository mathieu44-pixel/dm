/**
 * Import depuis un wiki MediaWiki (Fandom, umamusu.wiki…) — v1.1, étape 1 : accès.
 * MediaWiki expose une interface publique (api.php). Avec `origin=*`, une page web peut la lire
 * sans être connectée, si le site ne l'a pas désactivé.
 */

export interface WikiTarget {
  /** https://umamusu.wiki */
  origin: string
  /** Titre de la page indiquée (« List_of_Characters »), ou null pour la page d'accueil. */
  title: string | null
  /** Adresses possibles de l'interface, à essayer dans l'ordre. */
  apiCandidates: string[]
}

export function parseWikiUrl(input: string): WikiTarget | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const origin = url.origin
  let title: string | null = url.searchParams.get('title')
  if (!title) {
    const path = decodeURIComponent(url.pathname)
    const m = /^\/(?:wiki\/)?(.+)$/.exec(path)
    title = m && !/^(index|api)\.php$/.test(m[1]) ? m[1] : null
  }
  const isFandom = url.hostname.endsWith('fandom.com')
  return {
    origin,
    title: title ? title.replace(/ /g, '_') : null,
    apiCandidates: isFandom ? [`${origin}/api.php`] : [`${origin}/api.php`, `${origin}/w/api.php`],
  }
}

/** Adresse d'appel à l'interface, en lecture anonyme (origin=*). */
export function wikiApiUrl(api: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })
  return `${api}?${q.toString()}`
}

/** Liens internes d'une page (espace principal), sans doublons, dans l'ordre. */
export function articleLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return []
  const out = new Set<string>()
  for (const l of links as { ns?: number; title?: string; exists?: boolean }[])
    if (l && l.ns === 0 && typeof l.title === 'string' && l.exists !== false) out.add(l.title)
  return [...out]
}
