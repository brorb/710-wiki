export function normaliseColour(
  input?: string | null,
  numeric?: number | null,
): string | undefined {
  const trimmed = input?.trim()
  if (trimmed) {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`
  }
  if (typeof numeric === "number" && Number.isFinite(numeric)) {
    return `#${numeric.toString(16).padStart(6, "0")}`
  }
  return undefined
}

/**
 * Normalize a Discord username for fuzzy comparison.
 * Strips dots, underscores, dashes, and lowercases.
 * e.g. "pht_alt_" → "phtalt", "camera.3y3" → "camera3y3"
 */
export function normalizeUsername(username: string): string {
  return username.toLowerCase().replace(/[._\-]/g, "")
}

/**
 * Extract the avatar hash from a Discord CDN avatar URL.
 * Returns null for default avatars (e.g. /embed/avatars/0.png).
 * e.g. ".../avatars/12345/abcdef123.png?size=1024" → "abcdef123"
 */
export function extractAvatarId(url: string): string | null {
  const match = url.match(/\/avatars\/\d+\/([a-f0-9]+)/)
  return match ? match[1] : null
}
