import { useState, type ReactNode } from 'react'
import { patchSession } from '../../../data/sessions'
import { type Session } from '../../../engine/session/types'
import { searchEntries } from '../../../engine/session/search'
import { toEntries } from '../../../engine/session/thread'
import { LANGUAGES, LENGTHS, STYLES, lengthOption } from '../../../engine/session/options'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}
/** Recherche dans le fil affiché (v0.9). */
export function SearchSheet({
  entries,
  playerName,
  onClose,
  onPick,
}: {
  entries: ReturnType<typeof toEntries>
  playerName: string
  onClose: () => void
  onPick: (id: string, query: string) => void
}) {
  const [query, setQuery] = useState('')
  const hits = searchEntries(entries, query)
  const occurrences = hits.reduce((n, h) => n + h.count, 0)
  return (
    <Sheet title="Rechercher dans la partie" onClose={onClose}>
      <input
        autoFocus
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Un nom, un lieu, un objet…"
        className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-accent"
      />
      {query.trim().length >= 2 && (
        <p className="text-xs text-muted">
          {hits.length
            ? `${occurrences} occurrence${occurrences > 1 ? 's' : ''} dans ${hits.length} message${hits.length > 1 ? 's' : ''}`
            : 'Aucun résultat dans cette branche de la partie.'}
        </p>
      )}
      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onPick(h.id, query)}
              className="w-full rounded-xl border border-line bg-surface-2 p-3 text-left text-sm leading-relaxed"
            >
              <span className="mb-1 block text-xs text-muted">
                {h.index === 0 ? 'Prologue' : h.role === 'user' ? playerName : 'Narratrice'}
                {h.count > 1 ? ` · ${h.count} fois` : ''}
              </span>
              {h.before}
              <mark className="rounded bg-accent-soft px-0.5 text-accent">{h.match}</mark>
              {h.after}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
/** Réglages de la partie : longueur, style d'écriture, langue (comme « Length & Depth » et « Writing Style » d'OOC). */
export function SessionOptions({ session }: { session: Session }) {
  const length = lengthOption(session.length).id
  const style = session.writingStyle ?? 'story'
  const language = session.language ?? 'fr'
  const [custom, setCustom] = useState(session.customStyle ?? '')
  const segment = (active: boolean) =>
    'flex-1 rounded-lg px-2 py-2 text-xs transition ' + (active ? 'bg-accent text-ink' : 'text-muted')

  return (
    <div className="space-y-3 rounded-xl bg-surface-2 p-4 text-sm">
      <div>
        <p className="mb-2 text-muted">Longueur des réponses</p>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {LENGTHS.map((l) => (
            <button key={l.id} type="button" className={segment(length === l.id)} onClick={() => patchSession(session.id, { length: l.id })}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-2 block text-muted">Style d'écriture</span>
        <select
          value={style}
          onChange={(e) => patchSession(session.id, { writingStyle: e.target.value })}
          className="min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-sm outline-none focus:border-accent"
        >
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {style === 'custom' && (
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => patchSession(session.id, { customStyle: custom.trim() })}
          rows={3}
          placeholder="Décris le style voulu : ton, rythme, vocabulaire…"
          className="w-full rounded-xl border border-line bg-ink p-3 text-sm outline-none focus:border-accent"
        />
      )}
      <div>
        <p className="mb-2 text-muted">Langue de jeu</p>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {LANGUAGES.map((l) => (
            <button key={l.id} type="button" className={segment(language === l.id)} onClick={() => patchSession(session.id, { language: l.id })}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
