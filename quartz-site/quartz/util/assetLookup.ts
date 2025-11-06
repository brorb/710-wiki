import path from "node:path"
import { globbySync } from "globby"
import { FilePath, slugifyFilePath } from "./path"

const CONTENT_ROOT = path.resolve(process.cwd(), "../Content")
const assetLookupCache = new Map<string, string | null>()
const slugLookupCache = new Map<string, string | null>()
let slugLookupInitialised = false

const escapeForGlob = (value: string): string => value.replace(/([*?\[\]{}()!+@\\])/g, "\\$1")

const expandBasenameCandidates = (basename: string): string[] => {
  const candidates: string[] = []
  const seen = new Set<string>()

  const addCandidate = (value?: string) => {
    if (!value) {
      return
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    candidates.push(trimmed)
  }

  addCandidate(basename)

  try {
    addCandidate(decodeURIComponent(basename))
  } catch {
    // ignore decode errors
  }

  const hyphenAsSpace = basename.replace(/-/g, " ")
  addCandidate(hyphenAsSpace)
  try {
    addCandidate(decodeURIComponent(hyphenAsSpace))
  } catch {
    // ignore decode errors
  }

  const underscoreAsSpace = basename.replace(/_/g, " ")
  addCandidate(underscoreAsSpace)
  try {
    addCandidate(decodeURIComponent(underscoreAsSpace))
  } catch {
    // ignore decode errors
  }

  const spacesAsHyphen = basename.replace(/\s+/g, "-")
  addCandidate(spacesAsHyphen)

  return candidates
}

const ensureSlugLookup = (): void => {
  if (slugLookupInitialised) {
    return
  }

  const matches = globbySync("**/*", {
    cwd: CONTENT_ROOT,
    caseSensitiveMatch: false,
    onlyFiles: true,
  })

  matches.forEach((match) => {
    const normalised = match.replace(/\\/g, "/")
    const base = path.basename(normalised)
    const slugKey = slugifyFilePath(base as FilePath).toLowerCase()
    if (!slugLookupCache.has(slugKey)) {
      slugLookupCache.set(slugKey, normalised)
    }
  })

  slugLookupInitialised = true
}

export const findAssetByBasename = (basename: string): string | undefined => {
  const key = basename.toLowerCase()
  if (assetLookupCache.has(key)) {
    const cached = assetLookupCache.get(key)
    return cached === null ? undefined : cached
  }

  const candidates = expandBasenameCandidates(basename)
  for (const candidate of candidates) {
    const pattern = `**/${escapeForGlob(candidate)}`
    const matches = globbySync(pattern, {
      cwd: CONTENT_ROOT,
      caseSensitiveMatch: false,
      onlyFiles: true,
    })

    if (matches.length > 0) {
      matches.sort((a, b) => a.length - b.length || a.localeCompare(b))
      const resolved = matches[0].replace(/\\/g, "/")
      assetLookupCache.set(key, resolved)

      const slugKey = slugifyFilePath(path.basename(resolved) as FilePath).toLowerCase()
      if (!slugLookupCache.has(slugKey)) {
        slugLookupCache.set(slugKey, resolved)
      }

      return resolved
    }
  }

  ensureSlugLookup()

  const slugKey = slugifyFilePath(basename as FilePath).toLowerCase()
  if (slugLookupCache.has(slugKey)) {
    const mapped = slugLookupCache.get(slugKey)
    if (mapped) {
      assetLookupCache.set(key, mapped)
      return mapped
    }
    assetLookupCache.set(key, null)
    return undefined
  }

  assetLookupCache.set(key, null)
  slugLookupCache.set(slugKey, null)
  return undefined
}
