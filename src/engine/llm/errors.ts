/**
 * Traduit les erreurs des fournisseurs d'IA en messages compréhensibles.
 * On s'appuie sur le code HTTP (`status`) et le message, pour rester indépendant des SDK.
 */
export function describeLlmError(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: unknown }).status : undefined
  const provider = typeof error === 'object' && error !== null && 'provider' in error ? (error as { provider?: unknown }).provider : undefined
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''

  if (name === 'APIUserAbortError' || name === 'AbortError') return 'Génération interrompue.'
  if (name === 'APIConnectionError' || name === 'APIConnectionTimeoutError' || (name === 'TypeError' && /fetch/i.test(message)))
    return "Impossible de joindre le service d'IA. Vérifie ta connexion internet."

  // Gemini renvoie 400 (et non 401) pour une clé invalide.
  if (/API key not valid|API_KEY_INVALID/i.test(message)) return 'Clé API invalide. Vérifie-la dans les Réglages.'
  if (error instanceof Error && name === 'LlmError' && (error as { kind?: string }).kind) return message

  switch (status) {
    case 400:
      return `Requête refusée (400)${message ? ` : ${message}` : '.'}`
    case 401:
      return 'Clé API invalide (401). Vérifie-la dans les Réglages.'
    case 402:
      return 'Paiement requis (402). Ajoute du crédit sur ton compte.'
    case 403:
      return "Accès refusé (403). Ta clé n'a pas accès à ce modèle ou le service n'est pas activé."
    case 404:
      return "Modèle introuvable (404). Il n'est peut-être pas disponible pour ton compte."
    case 413:
      return 'Requête trop volumineuse (413).'
    case 429:
      return provider === 'gemini'
        ? 'Quota gratuit de Gemini atteint (429). Patiente une minute, ou jusqu\'à demain pour la limite journalière.'
        : 'Trop de requêtes ou limite de dépense atteinte (429). Patiente un peu ou vérifie ton crédit.'
    case 529:
      return 'Les serveurs sont surchargés (529). Réessaie dans quelques instants.'
  }
  if (typeof status === 'number' && status >= 500) return `Erreur côté serveur (${status}). Réessaie dans quelques instants.`

  return `Erreur inattendue : ${message || String(error)}`
}
