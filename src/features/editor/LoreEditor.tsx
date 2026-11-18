import { useState } from 'react'
import { newId } from '../../data/storyModel'
import { LORE_LIMITS, parseKeys, type LoreEntry } from '../../engine/lore/lore'
import { Button } from '../../ui/Button'
import { TextArea } from '../../ui/Field'

/** Édition du lorebook (v0.9.6) : entrées repliées, dépliées une à une. */
export function LoreEditor({ entries, onChange }: { entries: LoreEntry[]; onChange: (entries: LoreEntry[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const patchEntry = (id: string, p: Partial<LoreEntry>) => onChange(entries.map((e) => (e.id === id ? { ...e, ...p } : e)))

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        Des fiches sur l'univers (lieux, objets, factions, personnages secondaires). Chacune n'est envoyée à l'IA que lorsqu'un
        de ses mots-clés apparaît dans les {LORE_LIMITS.scanDepth} derniers messages : tu économises des jetons et la narratrice
        reste précise.
      </p>
      {entries.map((e) => {
        const open = openId === e.id
        return (
          <div key={e.id} className={'rounded-xl border bg-surface-2 ' + (e.disabled ? 'border-line opacity-60' : 'border-line')}>
            <button type="button" onClick={() => setOpenId(open ? null : e.id)} className="flex w-full items-start justify-between gap-3 p-3 text-left text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {e.alwaysOn ? '📌 Toujours active' : e.keys.length ? e.keys.join(', ') : 'Sans mot-clé'}
                </span>
                <span className="block truncate text-xs text-muted">{e.content || 'Fiche vide'}</span>
              </span>
              <span className="shrink-0 text-muted">{open ? '▴' : '▾'}</span>
            </button>
            {open && (
              <div className="space-y-3 border-t border-line p-3">
                <KeysField keys={e.keys} onChange={(keys) => patchEntry(e.id, { keys })} />
                <TextArea label="Contenu" value={e.content} onChange={(content) => patchEntry(e.id, { content })} rows={4} />
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    Toujours active
                    <span className="block text-xs text-muted">Envoyée à chaque tour, même sans mot-clé.</span>
                  </span>
                  <input type="checkbox" checked={!!e.alwaysOn} onChange={(ev) => patchEntry(e.id, { alwaysOn: ev.target.checked })} className="h-5 w-5 accent-[var(--color-accent)]" />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Désactivée</span>
                  <input type="checkbox" checked={!!e.disabled} onChange={(ev) => patchEntry(e.id, { disabled: ev.target.checked })} className="h-5 w-5 accent-[var(--color-accent)]" />
                </label>
                <Button variant="danger" onClick={() => onChange(entries.filter((x) => x.id !== e.id))}>
                  Supprimer la fiche
                </Button>
              </div>
            )}
          </div>
        )
      })}
      {entries.length < LORE_LIMITS.entries && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            const entry: LoreEntry = { id: newId(), keys: [], content: '' }
            onChange([...entries, entry])
            setOpenId(entry.id)
          }}
        >
          + Ajouter une fiche
        </Button>
      )}
    </div>
  )
}

/** Saisie libre des mots-clés ; la liste est relue à chaque frappe sans gêner la saisie. */
function KeysField({ keys, onChange }: { keys: string[]; onChange: (keys: string[]) => void }) {
  const [text, setText] = useState(keys.join(', '))
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">Mots-clés</span>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseKeys(e.target.value))
        }}
        placeholder="dragon, Ignis, la montagne"
        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
      />
      <span className="mt-1 block text-xs text-muted">Séparés par des virgules. Majuscules et accents ignorés.</span>
    </label>
  )
}
