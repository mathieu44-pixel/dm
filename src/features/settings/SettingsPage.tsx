import { useEffect, useRef, useState } from 'react'
import { downloadJson, exportAll, importBackup, parseBackup, summarizeBackup } from '../../data/backup'
import { setActiveProvider, updateProviderSettings, useSettings } from '../../data/settings'
import { maskApiKey } from '../../data/settingsModel'
import type { ProviderSettings } from '../../data/types'
import { createProvider, PROVIDER_LABELS, testConnection, type ConnectionTestResult } from '../../engine/llm/client'
import { describeLlmError } from '../../engine/llm/errors'
import { pickDefaultGeminiModels } from '../../engine/llm/gemini'
import { formatUsd, isModelId, MODELS } from '../../engine/llm/models'
import type { ModelOption, ProviderId } from '../../engine/llm/types'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'

const PROVIDERS: ProviderId[] = ['gemini', 'anthropic']

export default function SettingsPage() {
  const settings = useSettings()
  const [savedFlash, setSavedFlash] = useState(false)

  if (!settings) return null

  const provider = settings.provider
  const flashSaved = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1500)
  }

  return (
    <>
      <PageHeader title="Réglages" />
      <main className="space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Fournisseur d'IA</h2>
          <p className="mt-1 text-sm text-muted">Chaque fournisseur garde sa propre clé et ses modèles.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={async () => {
                  await setActiveProvider(p)
                  flashSaved()
                }}
                className={
                  'rounded-xl border px-3 py-3 text-left text-sm transition ' +
                  (provider === p ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2')
                }
              >
                <span className="block font-medium">{PROVIDER_LABELS[p].name}</span>
                <span className="mt-0.5 block text-xs text-muted">{PROVIDER_LABELS[p].hint}</span>
              </button>
            ))}
          </div>
        </section>

        {/* `key` : on repart d'un état propre quand on change de fournisseur. */}
        <ProviderPanel key={provider} provider={provider} config={settings[provider]} onSaved={flashSaved} />

        <BackupPanel />

        {savedFlash && (
          <p role="status" className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
            Enregistré
          </p>
        )}
      </main>
    </>
  )
}

function ProviderPanel({
  provider,
  config,
  onSaved,
}: {
  provider: ProviderId
  config: ProviderSettings
  onSaved: () => void
}) {
  const info = PROVIDER_LABELS[provider]
  const [keyDraft, setKeyDraft] = useState('')
  const [editingKey, setEditingKey] = useState(!config.apiKey)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [models, setModels] = useState<ModelOption[] | null>(null)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)

  const loadModels = async (apiKey: string) => {
    setLoadingModels(true)
    setModelsError(null)
    try {
      const list = await createProvider(provider, apiKey).listModels()
      setModels(list)
      // Gemini : on choisit automatiquement des modèles si aucun n'est encore défini.
      if (provider === 'gemini' && (!config.storyModel || !config.utilityModel)) {
        const defaults = pickDefaultGeminiModels(list)
        await updateProviderSettings(provider, {
          storyModel: config.storyModel || defaults.story || '',
          utilityModel: config.utilityModel || defaults.utility || '',
        })
      }
    } catch (error) {
      setModelsError(describeLlmError(error))
    } finally {
      setLoadingModels(false)
    }
  }

  // Charge la liste des modèles dès qu'une clé est disponible.
  useEffect(() => {
    if (config.apiKey) void loadModels(config.apiKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, config.apiKey])

  const saveKey = async () => {
    await updateProviderSettings(provider, { apiKey: keyDraft })
    setKeyDraft('')
    setEditingKey(false)
    setShowKey(false)
    setTestResult(null)
    onSaved()
  }

  const removeKey = async () => {
    if (!window.confirm(`Supprimer la clé ${info.name} de cet appareil ?`)) return
    await updateProviderSettings(provider, { apiKey: '' })
    setTestResult(null)
    setModels(null)
    setEditingKey(true)
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    setTestResult(await testConnection(provider, config.apiKey, config.storyModel))
    setTesting(false)
  }

  const trimmed = keyDraft.trim()
  const keyLooksOdd = trimmed.length > 0 && info.keyPrefix !== undefined && !trimmed.startsWith(info.keyPrefix)

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Clé API {info.name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {provider === 'gemini' ? (
            <>
              Crée une clé gratuite sur{' '}
              <a className="text-accent underline" href={info.keyUrl} target="_blank" rel="noreferrer">
                aistudio.google.com
              </a>{' '}
              avec ton compte Google (bouton « Create API key »).
            </>
          ) : (
            <>
              Crée une clé sur{' '}
              <a className="text-accent underline" href={info.keyUrl} target="_blank" rel="noreferrer">
                platform.claude.com
              </a>{' '}
              et fixe un plafond de dépense.
            </>
          )}{' '}
          La clé reste uniquement sur cet appareil.
        </p>

        {!editingKey && config.apiKey ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-surface-2 px-4 py-3 font-mono text-sm">{maskApiKey(config.apiKey)}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runTest} disabled={testing || !config.storyModel}>
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
                placeholder={info.keyPrefix ? `${info.keyPrefix}…` : 'Clé API'}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 font-mono text-sm outline-none focus:border-accent"
              />
              <Button variant="secondary" onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Masquer' : 'Voir'}
              </Button>
            </div>
            {keyLooksOdd && (
              <p className="text-xs text-amber-300">
                Les clés {info.name} commencent normalement par « {info.keyPrefix} ».
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={saveKey} disabled={!trimmed}>
                Enregistrer
              </Button>
              {config.apiKey && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingKey(false)
                    setKeyDraft('')
                  }}
                >
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
              ? `✓ Connexion réussie avec ${testResult.model} (${testResult.latencyMs} ms${
                  provider === 'anthropic' ? `, coût ${formatUsd(testResult.costUsd)}` : ', gratuit'
                }). Réponse : « ${testResult.reply} »`
              : `✗ ${testResult.error}`}
          </p>
        )}
      </section>

      {config.apiKey && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Modèles</h2>
            {provider === 'gemini' && (
              <Button variant="ghost" onClick={() => loadModels(config.apiKey)} disabled={loadingModels}>
                {loadingModels ? 'Chargement…' : 'Actualiser'}
              </Button>
            )}
          </div>
          {provider === 'gemini' && models && (
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={async () => {
                const d = pickDefaultGeminiModels(models)
                await updateProviderSettings(provider, { storyModel: d.story ?? '', utilityModel: d.utility ?? '' })
                onSaved()
              }}
            >
              Utiliser les modèles gratuits recommandés
            </Button>
          )}
          {modelsError && <p className="mt-2 rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-300">✗ {modelsError}</p>}

          <ModelPicker
            label="Rédaction de l'histoire"
            description="Écrit la narration et fait parler les personnages."
            value={config.storyModel}
            options={models}
            provider={provider}
            onChange={async (m) => {
              await updateProviderSettings(provider, { storyModel: m })
              onSaved()
            }}
          />
          <ModelPicker
            label="Tâches internes"
            description="Actions suggérées, mise à jour des stats, résumés. Un petit modèle suffit."
            value={config.utilityModel}
            options={models}
            provider={provider}
            onChange={async (m) => {
              await updateProviderSettings(provider, { utilityModel: m })
              onSaved()
            }}
          />
        </section>
      )}
    </>
  )
}

function ModelPicker({
  label,
  description,
  value,
  options,
  provider,
  onChange,
}: {
  label: string
  description: string
  value: string
  options: ModelOption[] | null
  provider: ProviderId
  onChange: (m: string) => void
}) {
  // Anthropic : cartes avec prix. Gemini : liste déroulante (les modèles disponibles varient).
  if (provider === 'gemini') {
    const list = options ?? []
    const hasValue = !value || list.some((o) => o.id === value)
    return (
      <label className="mt-5 block">
        <span className="text-sm font-medium">{label}</span>
        <span className="mb-2 block text-xs text-muted">{description}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
        >
          {!value && <option value="">— Choisir un modèle —</option>}
          {!hasValue && <option value={value}>{value} (indisponible ?)</option>}
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} · {o.id}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium">{label}</legend>
      <p className="mb-3 text-xs text-muted">{description}</p>
      <div className="space-y-2">
        {(options ?? []).map((o) => {
          const price = isModelId(o.id) ? MODELS[o.id].price : undefined
          return (
            <label
              key={o.id}
              className={
                'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ' +
                (value === o.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2')
              }
            >
              <input
                type="radio"
                name={label}
                checked={value === o.id}
                onChange={() => onChange(o.id)}
                className="accent-[var(--color-accent)]"
              />
              <span className="flex-1">
                <span className="font-medium">{o.label}</span>
                <span className="block text-xs text-muted">{o.hint}</span>
              </span>
              {price && (
                <span className="text-right text-xs text-muted">
                  {price.input} $ / {price.output} $<span className="block">par M tokens</span>
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Sauvegarde et restauration de toutes les données (hors clés API). */
function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const doExport = async () => {
    const backup = await exportAll()
    downloadJson(`dm-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, backup)
    setStatus({ ok: true, text: `Sauvegarde téléchargée : ${summarizeBackup(backup)}.` })
  }

  const doImport = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      if (!window.confirm(`Importer ${summarizeBackup(backup)} ? Les éléments identiques seront remplacés.`)) return
      await importBackup(backup)
      setStatus({ ok: true, text: `Import réussi : ${summarizeBackup(backup)}.` })
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Sauvegarde</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Tes histoires et parties sont stockées sur cet appareil. Exporte-les régulièrement : le fichier sert aussi à les
        transférer sur un autre appareil. Les clés API ne sont jamais incluses.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={doExport}>Exporter mes données</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Importer une sauvegarde
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void doImport(file)
          }}
        />
      </div>
      {status && (
        <p
          role="status"
          className={'mt-4 rounded-xl px-4 py-3 text-sm ' + (status.ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300')}
        >
          {status.ok ? '✓' : '✗'} {status.text}
        </p>
      )}
    </section>
  )
}
