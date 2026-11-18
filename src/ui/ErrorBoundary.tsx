import { Component, type ErrorInfo, type ReactNode } from 'react'
import { APP_VERSION } from '../app/version'

interface State {
  error: Error | null
  copied: boolean
}

/**
 * Écran de secours (v0.9.7) : si un écran plante, on affiche l'erreur au lieu d'un écran noir,
 * avec un moyen de revenir à l'accueil. Les données ne sont pas touchées.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, copied: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.details = `DM ${APP_VERSION} — ${location.hash}\n${error.name}: ${error.message}\n${error.stack ?? ''}\n${info.componentStack ?? ''}`
  }

  private details = ''

  private reset = (home: boolean) => {
    if (home) location.hash = '#/'
    this.setState({ error: null, copied: false })
  }

  private copy = async () => {
    try {
      await navigator.clipboard.writeText(this.details || String(this.state.error))
      this.setState({ copied: true })
    } catch {
      /* presse-papiers indisponible : le détail reste affiché à l'écran */
    }
  }

  render() {
    const { error, copied } = this.state
    if (!error) return this.props.children
    return (
      <main className="mx-auto flex min-h-full max-w-xl flex-col gap-4 p-6 pt-16 text-sm leading-relaxed">
        <h1 className="text-xl font-semibold text-accent">Quelque chose a planté</h1>
        <p>
          Cet écran a rencontré une erreur. Tes histoires et tes parties ne sont pas touchées. Reviens à l'accueil, et si ça
          se reproduit, copie le détail ci-dessous pour le signaler.
        </p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-xs text-muted">
          {error.name}: {error.message}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => this.reset(true)} className="rounded-full bg-accent px-4 py-2 font-medium text-ink">
            Retour à l'accueil
          </button>
          <button type="button" onClick={() => this.reset(false)} className="rounded-full border border-line px-4 py-2">
            Réessayer
          </button>
          <button type="button" onClick={() => void this.copy()} className="rounded-full border border-line px-4 py-2">
            {copied ? 'Détail copié ✓' : 'Copier le détail'}
          </button>
        </div>
      </main>
    )
  }
}
