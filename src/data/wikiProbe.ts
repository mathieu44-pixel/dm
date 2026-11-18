import { articleLinks, parseWikiUrl, wikiApiUrl } from '../engine/import/mediawiki'

/** Diagnostic d'accès à un wiki depuis l'application (v1.1, étape 1). */

export interface ProbeStep {
  label: string
  ok: boolean
  detail: string
}

const BLOCKED = "refusé par le site (accès depuis une application web non autorisé) ou réseau indisponible"

async function getJson(url: string): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: `le site a répondu ${res.status}` }
    const json = (await res.json()) as Record<string, unknown>
    const err = (json.error as { info?: string } | undefined)?.info
    return err ? { ok: false, error: err } : { ok: true, json }
  } catch {
    return { ok: false, error: BLOCKED }
  }
}

function textOfHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, .navbox, .reference, sup').forEach((n) => n.remove())
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export async function probeWiki(link: string, onStep: (steps: ProbeStep[]) => void): Promise<ProbeStep[]> {
  const steps: ProbeStep[] = []
  const push = (s: ProbeStep) => {
    steps.push(s)
    onStep([...steps])
  }
  const target = parseWikiUrl(link)
  if (!target) {
    push({ label: 'Lien', ok: false, detail: 'Lien non reconnu : colle une adresse complète (https://…).' })
    return steps
  }

  // 1. Interface du wiki
  let api: string | null = null
  let lastError = ''
  for (const candidate of target.apiCandidates) {
    const r = await getJson(wikiApiUrl(candidate, { action: 'query', meta: 'siteinfo', siprop: 'general' }))
    if (r.ok) {
      api = candidate
      const g = ((r.json.query as Record<string, unknown>)?.general ?? {}) as Record<string, string>
      push({ label: 'Interface du wiki', ok: true, detail: `${g.sitename ?? 'Wiki'} — ${g.generator ?? 'MediaWiki'} (${candidate})` })
      break
    }
    lastError = r.error
  }
  if (!api) {
    push({ label: 'Interface du wiki', ok: false, detail: lastError || BLOCKED })
    return steps
  }

  // 2. Lecture d'une page
  const page = target.title ?? 'Main_Page'
  const parsed = await getJson(wikiApiUrl(api, { action: 'parse', page, prop: 'text|links|displaytitle', redirects: '1' }))
  if (!parsed.ok) {
    push({ label: 'Lecture de la page', ok: false, detail: `${page} : ${parsed.error}` })
    return steps
  }
  const p = parsed.json.parse as { title?: string; text?: string; links?: unknown }
  const text = textOfHtml(p.text ?? '')
  const links = articleLinks(p.links)
  push({
    label: 'Lecture de la page',
    ok: text.length > 0,
    detail: `« ${p.title ?? page} » : ${text.length.toLocaleString('fr-FR')} caractères, ${links.length} liens vers d'autres articles. Début : ${text.slice(0, 160)}…`,
  })

  // 3. Images : la page indiquée, sinon le premier article lié qui en a une
  const titles = [p.title ?? page, ...links.slice(0, 20)].join('|')
  const imgs = await getJson(wikiApiUrl(api, { action: 'query', titles, prop: 'pageimages', piprop: 'original', redirects: '1' }))
  const pages = imgs.ok ? (((imgs.json.query as Record<string, unknown>)?.pages ?? []) as { title: string; original?: { source: string } }[]) : []
  const withImage = pages.find((x) => x.original?.source)
  if (!withImage?.original) {
    push({ label: "Adresse d'une image", ok: false, detail: imgs.ok ? 'aucune image principale trouvée sur ces pages' : imgs.error })
    return steps
  }
  push({ label: "Adresse d'une image", ok: true, detail: `${withImage.title} → ${withImage.original.source}` })
  try {
    const res = await fetch(withImage.original.source)
    const blob = res.ok ? await res.blob() : null
    push({
      label: "Téléchargement de l'image",
      ok: !!blob && blob.type.startsWith('image/'),
      detail: blob ? `${blob.type}, ${Math.round(blob.size / 1024)} Ko` : `le serveur d'images a répondu ${res.status}`,
    })
  } catch {
    push({ label: "Téléchargement de l'image", ok: false, detail: `serveur d'images : ${BLOCKED}` })
  }
  return steps
}
