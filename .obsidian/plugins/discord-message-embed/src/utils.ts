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
