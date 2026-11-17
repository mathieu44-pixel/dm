import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { saveStory, useStory } from '../../data/stories'
import { LIMITS, cleanSuggestions, newCharacter, newStory, parseTags, validateStory } from '../../data/storyModel'
import type { Character, StartSetting, Story } from '../../data/types'
import { Button } from '../../ui/Button'
import { TextArea, TextField } from '../../ui/Field'
import { NarrativeView } from '../../ui/NarrativeView'
import { PageHeader } from '../../ui/PageHeader'

const NEW_ID = 'nouvelle'

/** Création et modification d'une histoire (mode Story, un point de départ en v0.1). */
export default function StoryEditorPage() {
  const { id } = useParams()
  const isNew = id === NEW_ID
  const navigate = useNavigate()
  const existing = useStory(isNew ? undefined : id)

  const [story, setStory] = useState<Story | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [tagsText, setTagsText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Brouillon initialisé une seule fois (nouvelle histoire ou histoire existante).
  useEffect(() => {
    if (story) return
    if (isNew) {
      setStory(newStory())
    } else if (existing) {
      setStory(structuredClone(existing.story))
      setCharacters(structuredClone(existing.characters))
      setTagsText(existing.story.tags.join(', '))
    }
  }, [isNew, existing, story])

  if (!isNew && existing === null)
    return (
      <>
        <PageHeader title="Histoire introuvable" />
        <p className="p-6 text-sm text-muted">Cette histoire n'existe plus.</p>
      </>
    )
  if (!story) return null

  const patch = (p: Partial<Story>) => setStory({ ...story, ...p })
  const start = story.startSettings[0]
  const patchStart = (p: Partial<StartSetting>) => patch({ startSettings: [{ ...start, ...p }, ...story.startSettings.slice(1)] })

  const patchCharacter = (index: number, p: Partial<Character>) =>
    setCharacters(characters.map((c, i) => (i === index ? { ...c, ...p } : c)))
  const removeCharacter = (index: number) => {
    const name = characters[index].name || 'ce personnage'
    if (window.confirm(`Retirer ${name} de l'histoire ?`)) setCharacters(characters.filter((_, i) => i !== index))
  }

  const suggestions = [0, 1, 2].map((i) => start.initialSuggestions[i] ?? '')
  const setSuggestion = (index: number, value: string) => {
    const next = [...suggestions]
    next[index] = value
    patchStart({ initialSuggestions: next })
  }

  const save = async () => {
    const final: Story = {
      ...story,
      title: story.title.trim(),
      subtitle: story.subtitle.trim(),
      tags: parseTags(tagsText),
      startSettings: story.startSettings.map((s) => ({ ...s, initialSuggestions: cleanSuggestions(s.initialSuggestions) })),
    }
    const finalCharacters = characters.map((c) => ({ ...c, name: c.name.trim() }))
    const problems = validateStory(final, finalCharacters)
    setErrors(problems)
    if (problems.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    await saveStory(final, finalCharacters)
    setSaving(false)
    navigate(`/histoire/${final.id}`, { replace: true })
  }

  return (
    <>
      <PageHeader title={isNew ? 'Nouvelle histoire' : "Modifier l'histoire"} />
      <main className="space-y-6 px-4 py-6 pb-32">
        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-2xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}

        <Section title="Présentation">
          <TextField label="Titre" value={story.title} onChange={(v) => patch({ title: v })} maxLength={LIMITS.storyTitle} />
          <TextArea label="Accroche" value={story.subtitle} onChange={(v) => patch({ subtitle: v })} rows={2} hint="Une ou deux phrases affichées sur la fiche." />
          <TextField label="Tags" value={tagsText} onChange={setTagsText} placeholder="Fantasy, Mystère, Romance…" hint="Séparés par des virgules." />
        </Section>

        <Section title="Univers">
          <TextArea
            label="Monde, lieux, règles"
            value={story.worldLore}
            onChange={(v) => patch({ worldLore: v })}
            rows={8}
            hint="Tout ce que la narratrice doit savoir du monde : époque, lieux, factions, magie, ce qui est possible ou non."
          />
        </Section>

        <Section title="Narratrice">
          <TextArea
            label="Consignes"
            value={story.systemPrompt}
            onChange={(v) => patch({ systemPrompt: v })}
            rows={6}
            hint="Comment mener l'histoire : rythme, secrets à distiller, rôle du joueur, limites."
          />
          <TextArea
            label="Style d'écriture"
            value={story.writingRules}
            onChange={(v) => patch({ writingRules: v })}
            rows={3}
            hint="Ton, ambiance, longueur des descriptions…"
          />
        </Section>

        <Section title={`Personnages (${characters.length})`}>
          {characters.map((c, i) => (
            <details key={c.id} className="rounded-xl border border-line bg-surface-2" open={!c.name}>
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="text-sm font-medium">{c.name || 'Nouveau personnage'}</span>
                  {c.title && <span className="block text-xs text-muted">{c.title}</span>}
                </span>
                <span className="text-muted">▾</span>
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                <TextField label="Nom" value={c.name} onChange={(v) => patchCharacter(i, { name: v })} />
                <TextField label="Rôle" value={c.title} onChange={(v) => patchCharacter(i, { title: v })} placeholder="Aubergiste, capitaine…" />
                <TextArea label="Apparence" value={c.appearance} onChange={(v) => patchCharacter(i, { appearance: v })} rows={2} />
                <TextArea label="Personnalité" value={c.personality} onChange={(v) => patchCharacter(i, { personality: v })} rows={2} />
                <TextArea label="Façon de parler" value={c.speech} onChange={(v) => patchCharacter(i, { speech: v })} rows={2} />
                <TextArea
                  label="Histoire et secrets"
                  value={c.background}
                  onChange={(v) => patchCharacter(i, { background: v })}
                  rows={3}
                  hint="Le joueur ne voit pas ce texte : seule la narratrice le connaît."
                />
                <Button variant="danger" onClick={() => removeCharacter(i)}>
                  Retirer ce personnage
                </Button>
              </div>
            </details>
          ))}
          <Button variant="secondary" className="w-full" onClick={() => setCharacters([...characters, newCharacter()])}>
            + Ajouter un personnage
          </Button>
        </Section>

        <Section title="Point de départ">
          <TextField label="Nom" value={start.name} onChange={(v) => patchStart({ name: v })} />
          <TextArea
            label="Prologue"
            value={start.prologue}
            onChange={(v) => patchStart({ prologue: v })}
            rows={8}
            hint={
              <>
                Narration entre 「 et 」, une réplique par ligne au format <code>Nom | "réplique"</code>.
              </>
            }
          />
          {start.prologue.trim() && (
            <div className="rounded-xl border border-line bg-ink p-4">
              <p className="mb-3 text-xs uppercase tracking-wider text-muted">Aperçu</p>
              <NarrativeView text={start.prologue} />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Actions proposées au premier tour</p>
            {suggestions.map((s, i) => (
              <input
                key={i}
                value={s}
                onChange={(e) => setSuggestion(i, e.target.value)}
                placeholder={`Action ${i + 1} (facultatif)`}
                className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none focus:border-accent"
              />
            ))}
          </div>
        </Section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 mx-auto flex max-w-xl gap-3 border-t border-line bg-ink/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <Button variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
          Annuler
        </Button>
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </footer>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}
