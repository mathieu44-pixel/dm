/**
 * Couverture générée (en attendant les images en v0.5) : dégradé déterministe
 * calculé à partir du titre, pour que chaque histoire ait sa propre couleur.
 */
function hash(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return h
}

export function StoryCover({ title, className = '' }: { title: string; className?: string }) {
  const h = hash(title || '?')
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h % 80)) % 360
  const initial = (title.trim()[0] ?? '?').toUpperCase()
  return (
    <div
      className={'relative flex items-center justify-center overflow-hidden ' + className}
      style={{ background: `linear-gradient(145deg, hsl(${hue1} 45% 28%), hsl(${hue2} 50% 12%))` }}
      aria-hidden
    >
      <span className="font-[family-name:var(--font-story)] text-5xl font-semibold text-white/80 drop-shadow">{initial}</span>
    </div>
  )
}
