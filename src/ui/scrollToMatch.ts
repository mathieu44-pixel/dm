import { normalizeQuery, normalizeWithMap } from '../engine/session/search'

/** Ancêtre qui défile (la page entière par défaut). */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

/** Plage de texte de la première occurrence de `query` dans `root` (casse et accents ignorés). */
export function findTextRange(root: HTMLElement, query: string): Range | null {
  const q = normalizeQuery(query)
  if (!q) return null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: { node: Text; start: number }[] = []
  let raw = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: raw.length })
    raw += (n as Text).data
  }
  const { norm, map } = normalizeWithMap(raw)
  const at = norm.indexOf(q)
  if (at < 0) return null
  const startRaw = map[at]
  const endRaw = map[at + q.length - 1] + 1
  const locate = (pos: number, isEnd: boolean) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const { node, start } = nodes[i]
      if (isEnd ? pos > start : pos >= start) return { node, offset: Math.min(pos - start, node.data.length) }
    }
    return null
  }
  const a = locate(startRaw, false)
  const b = locate(endRaw, true)
  if (!a || !b) return null
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  return range
}

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void }
let clearTimer: number | undefined

/**
 * Fait défiler jusqu'au mot cherché (au tiers de l'écran, donc jamais sous l'en-tête)
 * et le surligne ; à défaut, fait clignoter le message entier.
 */
export function scrollToMatch(el: HTMLElement, query: string): void {
  const range = findTextRange(el, query)
  const target = range?.getBoundingClientRect() ?? el.getBoundingClientRect()
  const scroller = scrollParent(el)
  const offset = range ? window.innerHeight / 3 : 160
  scroller.scrollBy({ top: target.top - offset, behavior: 'smooth' })

  const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry })?.highlights
  const HighlightCtor = (globalThis as unknown as { Highlight?: new (r: Range) => unknown }).Highlight
  if (range && registry && HighlightCtor) {
    registry.set('search-match', new HighlightCtor(range))
    window.clearTimeout(clearTimer)
    clearTimer = window.setTimeout(() => registry.delete('search-match'), 4000)
    return
  }
  el.classList.remove('search-flash')
  void el.offsetWidth
  el.classList.add('search-flash')
}
