/** Dimensions réduites en gardant les proportions (le plus grand côté ≤ max). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** « salle commune, Nuit ,, nuit » → ["salle commune", "Nuit"] */
export function parseImageTags(input: string): string[] {
  const seen = new Set<string>()
  return input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => {
      const key = t.toLowerCase()
      if (!t || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 12)
}
