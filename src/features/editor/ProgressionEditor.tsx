import { newEnding, newStat } from '../../data/storyModel'
import type { StartSetting } from '../../data/types'
import { describeCondition } from '../../engine/progression/rules'
import { PROGRESSION_LIMITS, RARITIES, type Comparator, type Condition, type ConditionItem, type EndingDef, type StatDef } from '../../engine/progression/types'
import { Button } from '../../ui/Button'
import { TextArea, TextField } from '../../ui/Field'

const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent'
const COMPARATORS: { id: Comparator; label: string }[] = [
  { id: '>=', label: '≥' },
  { id: '<=', label: '≤' },
  { id: '>', label: '>' },
  { id: '<', label: '<' },
  { id: '==', label: '=' },
]

/** Éditeur des jauges et des fins d'un point de départ. */
export function ProgressionEditor({ start, onChange }: { start: StartSetting; onChange: (patch: Partial<StartSetting>) => void }) {
  const stats = start.stats ?? []
  const endings = start.endings ?? []

  const patchStat = (i: number, p: Partial<StatDef>) => onChange({ stats: stats.map((s, j) => (j === i ? { ...s, ...p } : s)) })
  const patchEnding = (i: number, p: Partial<EndingDef>) => onChange({ endings: endings.map((e, j) => (j === i ? { ...e, ...p } : e)) })

  return (
    <>
      {/* Jauges */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Jauges</p>
          <span className="text-xs text-muted">
            {stats.length}/{PROGRESSION_LIMITS.stats}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Des valeurs suivies pendant la partie (confiance, danger, indices…). Après chaque tour, l'IA propose une variation
          selon la règle que tu écris ; l'application l'applique et l'affiche.
        </p>
        {stats.map((s, i) => (
          <details key={s.id} className="rounded-xl border border-line bg-surface-2" open={!s.name}>
            <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-sm font-medium">
                {s.icon} {s.name || 'Nouvelle jauge'}
              </span>
              <span className="text-xs text-muted">
                {s.min}–{s.max}
              </span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <div className="grid grid-cols-[4rem_1fr] gap-2">
                <TextField label="Icône" value={s.icon} onChange={(v) => patchStat(i, { icon: v.slice(0, 4) })} placeholder="🤝" />
                <TextField label="Nom" value={s.name} onChange={(v) => patchStat(i, { name: v })} placeholder="Confiance de Maëlle" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <NumberField label="Min" value={s.min} onChange={(v) => patchStat(i, { min: v })} />
                <NumberField label="Max" value={s.max} onChange={(v) => patchStat(i, { max: v })} />
                <NumberField label="Départ" value={s.initial} onChange={(v) => patchStat(i, { initial: v })} />
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Couleur</span>
                  <input type="color" value={s.color} onChange={(e) => patchStat(i, { color: e.target.value })} className="h-11 w-full rounded-xl border border-line bg-surface-2" />
                </label>
              </div>
              <TextArea
                label="Règle d'évolution"
                value={s.rulesText}
                onChange={(v) => patchStat(i, { rulesText: v })}
                rows={2}
                hint="En langage courant : quand la jauge monte, quand elle baisse."
              />
              <div className="grid grid-cols-3 gap-2">
                <TextField label="Libellé bas" value={s.levels.low} onChange={(v) => patchStat(i, { levels: { ...s.levels, low: v } })} placeholder="méfiante" />
                <TextField label="Moyen" value={s.levels.mid} onChange={(v) => patchStat(i, { levels: { ...s.levels, mid: v } })} placeholder="neutre" />
                <TextField label="Haut" value={s.levels.high} onChange={(v) => patchStat(i, { levels: { ...s.levels, high: v } })} placeholder="alliée" />
              </div>
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm(`Supprimer la jauge « ${s.name || 'sans nom'} » ?`)) onChange({ stats: stats.filter((_, j) => j !== i) })
                }}
              >
                Supprimer la jauge
              </Button>
            </div>
          </details>
        ))}
        {stats.length < PROGRESSION_LIMITS.stats && (
          <Button variant="secondary" className="w-full" onClick={() => onChange({ stats: [...stats, newStat(stats.length)] })}>
            + Ajouter une jauge
          </Button>
        )}
      </div>

      {/* Fins */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Fins</p>
          <span className="text-xs text-muted">
            {endings.length}/{PROGRESSION_LIMITS.endings}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Une fin se déclenche dès que sa condition est remplie (dans l'ordre de la liste). Le joueur peut lire l'épilogue ou
          continuer l'histoire.
        </p>
        {endings.map((e, i) => (
          <details key={e.id} className="rounded-xl border border-line bg-surface-2" open={!e.name}>
            <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <span
                className="rounded px-1.5 py-0.5 text-[0.65rem] font-bold text-ink"
                style={{ background: RARITIES.find((r) => r.id === e.rarity)?.color }}
              >
                {e.rarity}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{e.name || 'Nouvelle fin'}</span>
                <span className="block text-xs text-muted">{describeCondition(e.condition, stats) || 'aucune condition'}</span>
              </span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <TextField label="Nom" value={e.name} onChange={(v) => patchEnding(i, { name: v })} placeholder="La lettre livrée" />
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Rareté</span>
                <select value={e.rarity} onChange={(ev) => patchEnding(i, { rarity: ev.target.value as EndingDef['rarity'] })} className={inputClass}>
                  {RARITIES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <ConditionEditor condition={e.condition} stats={stats} onChange={(condition) => patchEnding(i, { condition })} />
              <TextArea label="Texte de la carte" value={e.cardText} onChange={(v) => patchEnding(i, { cardText: v })} rows={2} />
              <TextArea label="Épilogue" value={e.epilogue} onChange={(v) => patchEnding(i, { epilogue: v })} rows={6} hint="Révélé quand le joueur retourne la carte." />
              <div className="flex flex-wrap gap-2">
                {i > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const next = [...endings]
                      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                      onChange({ endings: next })
                    }}
                  >
                    ↑ Monter
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(`Supprimer la fin « ${e.name || 'sans nom'} » ?`)) onChange({ endings: endings.filter((_, j) => j !== i) })
                  }}
                >
                  Supprimer la fin
                </Button>
              </div>
            </div>
          </details>
        ))}
        {endings.length < PROGRESSION_LIMITS.endings && (
          <Button variant="secondary" className="w-full" onClick={() => onChange({ endings: [...endings, newEnding()] })}>
            + Ajouter une fin
          </Button>
        )}
      </div>
    </>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={inputClass}
      />
    </label>
  )
}

/** Conditions d'une fin : liste à plat reliée par ET / OU (les conditions imbriquées restent lisibles mais non éditables). */
function ConditionEditor({ condition, stats, onChange }: { condition: Condition; stats: StatDef[]; onChange: (c: Condition) => void }) {
  const patchItem = (i: number, item: ConditionItem) => onChange({ ...condition, items: condition.items.map((it, j) => (j === i ? item : it)) })
  const remove = (i: number) => onChange({ ...condition, items: condition.items.filter((_, j) => j !== i) })

  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Condition</span>
        <div className="flex overflow-hidden rounded-lg border border-line text-xs">
          {(['AND', 'OR'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onChange({ ...condition, op })}
              className={'px-3 py-1.5 ' + (condition.op === op ? 'bg-accent text-ink' : 'text-muted')}
            >
              {op === 'AND' ? 'Toutes (ET)' : 'Une seule (OU)'}
            </button>
          ))}
        </div>
      </div>
      {condition.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {'op' in item ? (
            <span className="flex-1 text-xs text-muted">({describeCondition(item, stats)})</span>
          ) : item.type === 'turn' ? (
            <>
              <span className="w-24 shrink-0 text-sm">Tour ≥</span>
              <input
                type="number"
                inputMode="numeric"
                value={item.gte}
                onChange={(e) => patchItem(i, { type: 'turn', gte: Number(e.target.value) || 0 })}
                className={inputClass}
              />
            </>
          ) : (
            <>
              <select value={item.statId} onChange={(e) => patchItem(i, { ...item, statId: e.target.value })} className={inputClass + ' min-w-0 flex-[2]'}>
                {!stats.some((s) => s.id === item.statId) && <option value={item.statId}>Jauge supprimée</option>}
                {stats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || 'Jauge sans nom'}
                  </option>
                ))}
              </select>
              <select value={item.cmp} onChange={(e) => patchItem(i, { ...item, cmp: e.target.value as Comparator })} className={inputClass + ' w-16 shrink-0'}>
                {COMPARATORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="numeric"
                value={item.value}
                onChange={(e) => patchItem(i, { ...item, value: Number(e.target.value) || 0 })}
                className={inputClass + ' w-20 shrink-0'}
              />
            </>
          )}
          <button type="button" aria-label="Retirer cette condition" onClick={() => remove(i)} className="h-11 w-9 shrink-0 text-muted">
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="ghost" onClick={() => onChange({ ...condition, items: [...condition.items, { type: 'turn', gte: 20 }] })}>
          + Tour
        </Button>
        {stats.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => onChange({ ...condition, items: [...condition.items, { type: 'stat', statId: stats[0].id, cmp: '>=', value: Math.round((stats[0].min + stats[0].max) / 2) }] })}
          >
            + Jauge
          </Button>
        )}
      </div>
    </div>
  )
}
