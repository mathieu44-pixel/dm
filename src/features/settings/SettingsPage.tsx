import { useEffect, useState } from 'react'
import { saveSettings, useSettings } from '../../data/settings'
import { maskApiKey } from '../../data/settingsModel'
import { testConnection, type ConnectionTestResult } from '../../engine/llm/client'
import { MODEL_LIST, MODELS, formatUsd, type ModelId } from '../../engine/llm/models'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'

export default function SettingsPage() {
  const settings = useSettings()

  const [keyDraft, setKeyDraft] = useState('')
  const [editingKey, setEditingKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Sans clé enregistrée, on affiche directement le champ de saisie.
  useEffect(() => {
    if (settings && !settings.apiKey) setEditingKey(true)
  }, [settings])

  if (!settings) return null

  const flashSaved = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1500)
  }

  const saveKey = async () => {
    await saveSettings({ apiKey: keyDraft })
    setKeyDraft('')
    setEditingKey(false)
    setShowKey(false)
    setTestResult(null)
    flashSaved()
  }

  const removeKey = async () => {
    if (!window.confirm('Supprimer la clé API de cet appareil ?')) return
    await saveSettings({ apiKey: '' })
    setTestResult(null)
  }

  const setModel = async (field: 'storyModel' | 'utilityModel', value: ModelId) => {
    await saveSettings({ [field]: value })
    flashSaved()
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    setTestResult(await testConnection(settings.apiKey, settings.storyModel))
    setTesting(false)
  }

  const keyLooksOdd = keyDraft.trim().length > 0 && !keyDraft.trim().startsWith('sk-ant-')

  return (
    <>
      <PageHeader title="Réglages" />
      <main className="space-y-6 px-4 py-6">
        {/* Clé API */}
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Clé API Anthropic</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Crée une clé sur{' '}
            <a className="text-accent underline" href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">
              platform.claude.com
            </a>{' '}
            et fixe un plafond de dépense. La clé reste uniquement sur cet appareil.
          </p>

          {!editingKey && settings.apiKey ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-surface-2 px-4 py-3 font-mono text-sm">{maskApiKey(settings.apiKey)}</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={runTest} disabled={testing}>
                  {testing ? 'Test en cours…' : 'Tester la connexion'}
                </Button>
                <Button variant="secondary" onClick={() => setEditingKey(true)}>
                  Remplacer
                </Button>
                <Button variant="danger" onClick={removeKey}>
                  Supprimer
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="sk-ant-…"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-11 flex-1 rounded-xl border border-line bg-surface-2 px-4 font-mono text-sm outline-none focus:border-accent"
                />
                <Button variant="secondary" onClick={() => setShowKey((v) => !v)} aria-label="Afficher la clé">
                  {showKey ? 'Masquer' : 'Voir'}
                </Button>
              </div>
              {keyLooksOdd && (
                <p className="text-xs text-amber-300">Les clés Anthropic commencent normalement par « sk-ant- ».</p>
              )}
              <div className="flex gap-2">
                <Button onClick={saveKey} disabled={!keyDraft.trim()}>
                  Enregistrer
                </Button>
                {settings.apiKey && (
                  <Button variant="ghost" onClick={() => { setEditingKey(false); setKeyDraft('') }}>
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          )}

          {testResult && (
            <p
              role="status"
              className={
                'mt-4 rounded-xl px-4 py-3 text-sm ' +
                (testResult.ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300')
              }
            >
              {testResult.ok
                ? `✓ Connexion réussie avec ${MODELS[testResult.model].hint.split(' —')[0]} (${testResult.latencyMs} ms, coût ${formatUsd(testResult.costUsd)}).`
                : `✗ ${testResult.error}`}
            </p>
          )}
        </section>

        {/* Modèles */}
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Modèles</h2>

          <ModelPicker
            label="Rédaction de l'histoire"
            description="Écrit la narration et fait parler les personnages."
            value={settings.storyModel}
            onChange={(m) => setModel('storyModel', m)}
          />
          <ModelPicker
            label="Tâches internes"
            description="Actions suggérées, mise à jour des stats, résumés. Haiku suffit et coûte très peu."
            value={settings.utilityModel}
            onChange={(m) => setModel('utilityModel', m)}
          />
        </section>

        {savedFlash && (
          <p role="status" className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
            Enregistré
          </p>
        )}
      </main>
    </>
  )
}

function ModelPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: ModelId
  onChange: (m: ModelId) => void
}) {
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium">{label}</legend>
      <p className="mb-3 text-xs text-muted">{description}</p>
      <div className="space-y-2">
        {MODEL_LIST.map((m) => (
          <label
            key={m.id}
            className={
              'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ' +
              (value === m.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2')
            }
          >
            <input
              type="radio"
              name={label}
              checked={value === m.id}
              onChange={() => onChange(m.id)}
              className="accent-[var(--color-accent)]"
            />
            <span className="flex-1">
              <span className="font-medium">{m.label}</span>
              <span className="block text-xs text-muted">{m.hint}</span>
            </span>
            <span className="text-right text-xs text-muted">
              {m.price.input} $ / {m.price.output} $
              <span className="block">par M tokens</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
