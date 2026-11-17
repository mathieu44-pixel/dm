/** Version affichée dans l'application. Mise à jour à chaque livraison. */
export const APP_VERSION = '0.7.0'

/** Étapes prévues, affichées sur l'écran d'accueil tant que l'app est en construction. */
export const ROADMAP: ReadonlyArray<{ version: string; label: string }> = [
  { version: '0.1', label: 'Jouer une histoire (MVP)' },
  { version: '0.2', label: 'Bibliothèque, historique, sauvegardes' },
  { version: '0.3', label: 'Mémoire' },
  { version: '0.4', label: 'Stats & fins' },
  { version: '0.5', label: 'Images & galerie' },
  { version: '0.6', label: 'Branches & commandes' },
  { version: '0.7', label: 'Mode Character & import SillyTavern' },
  { version: '0.8', label: 'Assistant de création' },
  { version: '0.9', label: 'Coûts & relecture' },
]

/** Indique si une étape de la feuille de route est déjà livrée. */
export function isDelivered(stepVersion: string, current: string = APP_VERSION): boolean {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [a, b] = [parse(stepVersion), parse(current)]
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return y > x
  }
  return true
}
