import { useState } from 'react'
import { probeWiki, type ProbeStep } from '../../data/wikiProbe'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'

const EXAMPLES = ['https://umamusu.wiki/List_of_Characters', 'https://umamusume.fandom.com/wiki/Umamusume_Wiki']

/** Importer un univers (v1.1) — étape 1 : tester l'accès à un wiki depuis le téléphone. */
export default function ImportUniversePage() {
  const [link, setLink] = useState('')
  const [steps, setSteps] = useState<ProbeStep[]>([])
  const [busy, setBusy] = useState(false)

  const run = async (target = link) => {
    if (!target.trim()) return
    setLink(target)
    setBusy(true)
    setSteps([])
    try {
      await probeWiki(target, setSteps)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Importer un univers" />
      <main className="flex flex-col gap-5 p-5 pb-16 text-sm">
        <p className="leading-relaxed text-muted">
          Étape 1 : vérifier que DM peut lire un wiki directement depuis ton téléphone (texte, liens, images). L'import des
          personnages arrivera ensuite, selon le résultat.
        </p>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={busy}
          placeholder="https://umamusu.wiki/List_of_Characters"
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" disabled={busy} onClick={() => void run(e)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
              {new URL(e).hostname}
            </button>
          ))}
        </div>
        <Button onClick={() => void run()} disabled={busy || !link.trim()}>
          {busy ? 'Test en cours…' : "Tester l'accès"}
        </Button>
        {steps.length > 0 && (
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface p-3">
                <p className={'font-medium ' + (s.ok ? 'text-emerald-300' : 'text-red-300')}>
                  {s.ok ? '✓' : '✗'} {s.label}
                </p>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted">{s.detail}</p>
              </li>
            ))}
          </ol>
        )}
        {!busy && steps.length > 0 && <p className="text-xs text-muted">Envoie-moi une capture de ce résultat.</p>}
      </main>
    </>
  )
}
