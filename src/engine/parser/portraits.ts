/** Portrait d'un personnage : nom exact, ou premier mot du nom (« Maëlle » pour « Maëlle Vautrin »). */
export function findPortrait(speaker: string, portraits: Record<string, string>): string | undefined {
  const key = speaker.trim().toLowerCase()
  const entries = Object.entries(portraits).map(([name, id]) => [name.trim().toLowerCase(), id] as const)
  // 1. Nom exact.
  const exact = entries.find(([n]) => n === key)
  if (exact) return exact[1]
  // 2. Un mot du nom (« Hwaryeon » pour « Hong Hwaryeon »), seulement s'il désigne un seul personnage :
  //    « Han » ne doit pas confondre Han Yuri et Han Gyeoul.
  const words = key.split(/\s+/)
  const matches = entries.filter(([n]) => {
    const parts = n.split(/\s+/)
    return parts.includes(key) || words.some((w) => w.length >= 3 && parts.includes(w))
  })
  const ids = [...new Set(matches.map(([, id]) => id))]
  return ids.length === 1 ? ids[0] : undefined
}
