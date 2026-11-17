/**
 * Traduit les erreurs de l'API Anthropic en messages compréhensibles.
 * On s'appuie sur le code HTTP (champ `status`) plutôt que sur les classes du SDK,
 * pour que cette fonction reste testable sans le SDK.
 */
export function describeLlmError(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: unknown }).status : undefined
  const name = error instanceof Error ? error.name : ''

  if (name === 'APIUserAbortError' || name === 'AbortError') return 'Génération interrompue.'
  if (name === 'APIConnectionError' || name === 'APIConnectionTimeoutError')
    return 'Impossible de joindre Anthropic. Vérifie ta connexion internet.'

  switch (status) {
    case 400:
      return "Requête refusée par l'API (400). Le message est peut-être trop long ou mal formé."
    case 401:
      return 'Clé API invalide (401). Vérifie-la dans les Réglages.'
    case 402:
      return 'Paiement requis (402). Ajoute du crédit sur ton compte Claude Console.'
    case 403:
      return "Accès refusé (403). Ta clé n'a pas accès à ce modèle ou ton compte est restreint."
    case 404:
      return "Modèle introuvable (404). Il n'est peut-être pas disponible pour ton compte."
    case 413:
      return 'Requête trop volumineuse (413).'
    case 429:
      return 'Trop de requêtes ou limite de dépense atteinte (429). Patiente un peu ou vérifie ton crédit.'
    case 529:
      return 'Les serveurs Anthropic sont surchargés (529). Réessaie dans quelques instants.'
  }
  if (typeof status === 'number' && status >= 500) return `Erreur côté Anthropic (${status}). Réessaie dans quelques instants.`

  const message = error instanceof Error && error.message ? error.message : String(error)
  return `Erreur inattendue : ${message}`
}
