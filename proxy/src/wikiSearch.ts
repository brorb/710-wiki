import FlexSearch, { DefaultDocumentSearchResults } from "flexsearch"
import fs from "node:fs/promises"
import path from "node:path"

import { config } from "./config.js"

type SerializedContentDetails = {
  slug: string
  filePath: string
  title: string
  links: string[]
  tags: string[]
  content: string
  updated?: string
  searchAliases?: string[]
}

type ContentIndex = Record<string, SerializedContentDetails>

type SearchDoc = {
  id: number
  slug: string
  title: string
  content: string
  rawContent: string
  tags: string[]
  aliases: string[]
  updated?: string
}

export type SearchResult = {
  slug: string
  title: string
  snippet: string
  score: number
  literalScore: number
  matchBonus?: number
  rank: number
  tags: string[]
  aliases: string[]
  updated?: string
  url?: string
}

const DEFAULT_LIMIT = config.searchResultLimit ?? 8
const MIN_QUERY_LENGTH = 2
const CONTEXT_WINDOW_WORDS = 30
const LOG_PATH_SIGNATURE = ["youtube", "videos", "7-10 tone"]
const LOG_NUMBER_REGEX = /\d+/g
const LOG_ALIAS_MAP_CANDIDATES = [
  path.resolve(process.cwd(), "quartz-site/quartz/data/log_alias_map.json"),
  path.resolve(process.cwd(), "quartz-site/data/log_alias_map.json"),
  path.resolve(process.cwd(), "data/log_alias_map.json"),
  path.resolve(process.cwd(), "../quartz-site/quartz/data/log_alias_map.json"),
  path.resolve(process.cwd(), "../quartz-site/data/log_alias_map.json"),
  path.resolve(process.cwd(), "../data/log_alias_map.json"),
]

const DEFAULT_INDEX_CANDIDATES = [
  path.resolve(process.cwd(), "quartz-site/public/static/contentIndex.json"),
  path.resolve(process.cwd(), "quartz-site/public/contentIndex.json"),
  path.resolve(process.cwd(), "public/static/contentIndex.json"),
  path.resolve(process.cwd(), "public/contentIndex.json"),
]

const LITERAL_SEARCH_ENABLED = config.literalSearchEnabled ?? true
const LITERAL_MAX_RESULTS = config.literalSearchMaxResults ?? 2
const LITERAL_MIN_SCORE = config.literalSearchMinScore ?? 0.55
const LITERAL_SCORE_BASE = config.literalSearchScoreBase ?? 0.78
const LITERAL_SCORE_BONUS = config.literalSearchScoreBonus ?? 0.04
const LITERAL_TITLE_MATCH_BOOST = config.literalSearchTitleMatchBoost ?? 0.35
const SNIPPET_CHAR_LIMIT = config.literalSearchSnippetChars ?? 600

const encoder = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)

const truncateSnippet = (value: string, limit: number): string => {
  if (!value) {
    return ""
  }
  if (value.length <= limit) {
    return value
  }
  const truncated = value.slice(0, limit).trimEnd()
  return truncated.length === 0 ? value.slice(0, limit) : `${truncated} …`
}

const normaliseKey = (input: string): string | null => {
  if (!input) {
    return null
  }
  const trimmed = input.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

const collectKeyVariants = (value: string): string[] => {
  const normalised = normaliseKey(value)
  if (!normalised) {
    return []
  }

  const variants = new Set<string>()
  variants.add(normalised)

  const collapsedSpaces = normalised.replace(/\s+/g, " ")
  variants.add(collapsedSpaces)
  variants.add(collapsedSpaces.replace(/\s+/g, "-"))
  variants.add(collapsedSpaces.replace(/\s+/g, "_"))

  const compact = normalised.replace(/[\s_-]+/g, "")
  if (compact.length > 0) {
    variants.add(compact)
  }

  const alnum = normalised.replace(/[^a-z0-9]+/g, "")
  if (alnum.length > 0) {
    variants.add(alnum)
  }

  return Array.from(variants)
}

const buildKeySet = (values: string[]): Set<string> => {
  const keys = new Set<string>()
  for (const value of values) {
    collectKeyVariants(value).forEach((variant) => {
      if (variant.length > 0) {
        keys.add(variant)
      }
    })
  }
  return keys
}

const buildQueryKeySet = (query: string): Set<string> => {
  const keys = buildKeySet([query])
  const tokens = query
    .split(/[\s,;:/\\|]+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
  tokens.forEach((token) => {
    collectKeyVariants(token).forEach((variant) => keys.add(variant))
  })
  return keys
}

const hasKeyIntersection = (a: Set<string>, b: Set<string>): boolean => {
  for (const candidate of a) {
    if (b.has(candidate)) {
      return true
    }
  }
  return false
}

type FieldWeight = "title" | "aliases" | "content" | "tags"

const FIELD_WEIGHTS: Record<FieldWeight, number> = {
  title: 3,
  aliases: 2.5,
  tags: 1.5,
  content: 1,
}

type AggregatedScore = {
  score: number
  priority: number
}

const tokenizeTerm = (term: string) => {
  const tokens = term
    .toLowerCase()
    .split(/\s+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)

  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "))
    }
  }

  return tokens.sort((a, b) => b.length - a.length)
}

const buildSnippet = (term: string, text: string, limit: number): string => {
  if (!text) {
    return ""
  }
  const tokenizedText = text.split(/\s+/).filter((piece) => piece.length > 0)
  if (tokenizedText.length === 0) {
    return truncateSnippet(text, limit)
  }

  const termTokens = tokenizeTerm(term)
  const lowerTokens = termTokens.map((token) => token.toLowerCase())

  let windowStart = 0
  let bestSum = 0
  let bestIndex = 0

  const lowerWords = tokenizedText.map((piece) => piece.toLowerCase())
  const occurrences = lowerWords.map((word) => lowerTokens.some((token) => word.includes(token)))

  for (let i = 0; i < Math.max(tokenizedText.length - CONTEXT_WINDOW_WORDS, 0); i++) {
    const window = occurrences.slice(i, i + CONTEXT_WINDOW_WORDS)
    const windowSum = window.reduce((total, occurs) => total + (occurs ? 1 : 0), 0)
    if (windowSum >= bestSum) {
      bestSum = windowSum
      bestIndex = i
    }
  }

  windowStart = Math.max(bestIndex - CONTEXT_WINDOW_WORDS, 0)
  const windowEnd = Math.min(windowStart + 2 * CONTEXT_WINDOW_WORDS, tokenizedText.length - 1)

  const slice = tokenizedText.slice(windowStart, windowEnd + 1).join(" ")

  const prefix = windowStart === 0 ? "" : "…"
  const suffix = windowEnd === tokenizedText.length - 1 ? "" : "…"
  const snippet = `${prefix}${slice}${suffix}`
  return truncateSnippet(snippet, limit)
}

const normaliseAliases = (aliases?: string[]): string[] => {
  if (!aliases || aliases.length === 0) {
    return []
  }
  const seen = new Set<string>()
  for (const alias of aliases) {
    const trimmed = alias.trim()
    if (!trimmed) {
      continue
    }
    const lowered = trimmed.toLowerCase()
    if (!seen.has(lowered)) {
      seen.add(lowered)
    }
  }
  return Array.from(seen)
}

const stripExtension = (value: string): string => value.replace(/\.[^.]+$/u, "")

const basename = (value: string): string => {
  const normalized = value.replace(/\\/g, "/")
  const parts = normalized.split("/")
  return parts.length > 0 ? parts[parts.length - 1] ?? value : value
}

const expandLogAlias = (label: string): string[] => {
  const normalized = label.trim()
  if (normalized.length === 0) {
    return []
  }
  const tokens = new Set<string>()
  const lowered = normalized.toLowerCase()
  tokens.add(normalized)
  tokens.add(lowered)

  const digits = normalized.match(LOG_NUMBER_REGEX) ?? []
  for (const sequence of digits) {
    const trimmed = sequence.replace(/^0+(\d)/u, "$1")
    const padded = sequence.length <= 3 ? sequence.padStart(3, "0") : sequence
    const variants = new Set([sequence, padded, trimmed])
    for (const variant of variants) {
      if (!variant) {
        continue
      }
      tokens.add(variant)
      tokens.add(`log ${variant}`)
      tokens.add(`log-${variant}`)
      tokens.add(`log${variant}`)
      tokens.add(`log_${variant}`)
    }
  }

  const collapsedSpace = normalized.replace(/\s+/g, " ")
  const hyphenated = normalized.replace(/\s+/g, "-")
  const compact = normalized.replace(/\s+/g, "")

  tokens.add(collapsedSpace)
  tokens.add(hyphenated)
  tokens.add(compact)

  return Array.from(tokens).filter((token) => token.length > 0)
}

type RawLogAliasMap = Record<string, string[]>

let cachedLogAliasMap: Map<string, string[]> | null = null

const buildLogAliasMap = (raw: RawLogAliasMap): Map<string, string[]> => {
  return new Map<string, string[]>(
    Object.entries(raw || {}).map(([rawKey, canonicalPieces]) => {
      const normalizedKey = stripExtension(rawKey).trim().toLowerCase()
      const aliasSet = new Set<string>()

      expandLogAlias(rawKey).forEach((alias) => aliasSet.add(alias))

      const stripped = stripExtension(rawKey)
      aliasSet.add(stripped)
      aliasSet.add(stripped.toLowerCase())

      for (const piece of canonicalPieces ?? []) {
        expandLogAlias(piece).forEach((alias) => aliasSet.add(alias))
      }

      return [normalizedKey, Array.from(aliasSet)]
    }),
  )
}

const loadRawLogAliasMap = async (): Promise<RawLogAliasMap> => {
  for (const candidate of LOG_ALIAS_MAP_CANDIDATES) {
    try {
      const contents = await fs.readFile(candidate, "utf8")
      return JSON.parse(contents) as RawLogAliasMap
    } catch (error) {
      continue
    }
  }
  return {}
}

const ensureLogAliasMap = async (): Promise<Map<string, string[]>> => {
  if (!cachedLogAliasMap) {
    const raw = await loadRawLogAliasMap()
    cachedLogAliasMap = buildLogAliasMap(raw)
  }
  return cachedLogAliasMap
}

const resetLogAliasCache = (): void => {
  cachedLogAliasMap = null
}

const isLogEntry = (entry: SerializedContentDetails): boolean => {
  const reference = entry.filePath || entry.slug
  if (!reference) {
    return false
  }
  const normalized = reference.replace(/\\/g, "/").toLowerCase()
  return LOG_PATH_SIGNATURE.every((segment) => normalized.includes(segment))
}

const deriveLogAliases = (
  entry: SerializedContentDetails,
  aliasMap: Map<string, string[]>,
): string[] => {
  if (!isLogEntry(entry)) {
    return []
  }

  const baseSegment = basename(entry.filePath || entry.slug)
  const base = stripExtension(baseSegment)
  if (!base) {
    return []
  }

  const key = base.trim().toLowerCase()
  const aliasSet = new Set<string>(aliasMap.get(key) ?? [])
  expandLogAlias(base).forEach((alias) => aliasSet.add(alias))

  return Array.from(aliasSet)
}

const mergeAliases = (entryAliases?: string[], derivedAliases?: string[]): string[] => {
  return normaliseAliases([...(entryAliases ?? []), ...(derivedAliases ?? [])])
}

type FlexSearchDocument<T> = {
  addAsync: (id: number, doc: T) => Promise<void>
  searchAsync: (options: { query: string; limit: number; index: string[] }) => Promise<DefaultDocumentSearchResults<any>>
}

const FlexSearchModule = FlexSearch as unknown as {
  Document: new (options: unknown) => FlexSearchDocument<SearchDoc>
}

export class WikiSearchService {
  private index: FlexSearchDocument<SearchDoc> | null = null
  private documents: Map<number, SearchDoc> = new Map()
  private slugToDoc: Map<string, SearchDoc> = new Map()
  private ready: Promise<void> | null = null
  private lastLoadedAt: number | null = null

  constructor(private readonly options?: { indexPath?: string; indexUrl?: string; baseUrl?: string; limit?: number }) {
    this.ready = this.reload()
  }

  async ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.reload()
    }
    await this.ready
  }

  async reload(): Promise<void> {
    resetLogAliasCache()
    const data = await this.loadContentIndex()
    await this.populateIndex(data)
    this.lastLoadedAt = Date.now()
  }

  private resolveIndexCandidates(): string[] {
    const explicit = this.options?.indexPath?.trim()
    const candidates = [...DEFAULT_INDEX_CANDIDATES]
    if (explicit && !candidates.includes(explicit)) {
      candidates.unshift(explicit)
    }
    return candidates
  }

  private async loadContentIndex(): Promise<ContentIndex> {
    const candidates = this.resolveIndexCandidates()
    for (const candidate of candidates) {
      try {
        const contents = await fs.readFile(candidate, "utf8")
        const parsed = JSON.parse(contents) as ContentIndex
        return parsed
      } catch (error) {
        continue
      }
    }

    if (this.options?.indexUrl) {
      const response = await fetch(this.options.indexUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch content index: ${response.status} ${response.statusText}`)
      }
      const parsed = (await response.json()) as ContentIndex
      return parsed
    }

    throw new Error("Unable to locate wiki content index JSON")
  }

  private async populateIndex(data: ContentIndex): Promise<void> {
  const document = new FlexSearchModule.Document({
      encode: encoder,
      document: {
        id: "id",
        tag: "tags",
        index: [
          {
            field: "title",
            tokenize: "forward",
          },
          {
            field: "content",
            tokenize: "forward",
          },
          {
            field: "tags",
            tokenize: "forward",
          },
          {
            field: "aliases",
            tokenize: "forward",
          },
        ],
      },
    })

    const aliasMap = await ensureLogAliasMap()

    this.index = document
    this.documents.clear()
    this.slugToDoc.clear()

    let nextId = 0
    const tasks: Array<Promise<unknown>> = []
    for (const [slug, entry] of Object.entries(data)) {
      const id = nextId++
      const derivedAliases = deriveLogAliases(entry, aliasMap)
      const aliases = mergeAliases(entry.searchAliases, derivedAliases)
      const aliasText = aliases.join(" ")
      const baseContent = entry.content ?? ""
      const contentWithAliases = aliasText ? `${baseContent}\n${aliasText}` : baseContent
      const doc: SearchDoc = {
        id,
        slug,
        title: entry.title ?? slug,
        content: contentWithAliases,
        rawContent: baseContent,
        tags: entry.tags ?? [],
        aliases,
        updated: entry.updated,
      }

      this.documents.set(id, doc)
      this.slugToDoc.set(slug, doc)

      tasks.push(document.addAsync(id, doc))
    }

    await Promise.all(tasks)
  }

  private aggregateResults(
    query: string,
    searchResults: DefaultDocumentSearchResults<SearchDoc>,
    limit: number,
  ): SearchResult[] {
    if (!searchResults || searchResults.length === 0) {
      return []
    }

    const aggregated = new Map<number, AggregatedScore>()
    const fieldPriority: FieldWeight[] = ["title", "aliases", "content", "tags"]

    const getByField = (field: FieldWeight): number[] => {
      const resultsForField = searchResults.filter((result) => result.field === field)
      if (resultsForField.length === 0) {
        return []
      }
      return [...resultsForField[0].result] as number[]
    }

    fieldPriority.forEach((field, idx) => {
      const ids = getByField(field)
      const weight = FIELD_WEIGHTS[field]
      ids.forEach((id, position) => {
        const current = aggregated.get(id) ?? { score: 0, priority: Number.POSITIVE_INFINITY }
        const positionBoost = Math.max(1, ids.length - position)
        current.score += weight * positionBoost
        current.priority = Math.min(current.priority, idx)
        aggregated.set(id, current)
      })
    })

    const sorted = [...aggregated.entries()]
      .sort((a, b) => {
        const scoreDelta = b[1].score - a[1].score
        if (scoreDelta !== 0) {
          return scoreDelta
        }
        return a[1].priority - b[1].priority
      })
      .slice(0, limit * 2)

    const bestRawScore = sorted.length > 0 ? sorted[0][1].score : 0
    const literalLimit = Math.max(1, Math.min(LITERAL_MAX_RESULTS, limit))
    const queryKeys = buildQueryKeySet(query)

    const results: SearchResult[] = []
    for (const [id, meta] of sorted) {
      const doc = this.documents.get(id)
      if (!doc) {
        continue
      }

      const normalizedScore = bestRawScore > 0 ? meta.score / bestRawScore : 0
      if (LITERAL_SEARCH_ENABLED && normalizedScore < LITERAL_MIN_SCORE) {
        continue
      }

      const aliasKeys = buildKeySet([doc.slug, doc.title, ...doc.aliases])
      const hasExactMatch =
        LITERAL_SEARCH_ENABLED &&
        LITERAL_TITLE_MATCH_BOOST > 0 &&
        hasKeyIntersection(aliasKeys, queryKeys)

      const matchBonus = hasExactMatch ? LITERAL_TITLE_MATCH_BOOST : 0
      const rank = results.length + 1

      let finalScore = normalizedScore
      if (LITERAL_SEARCH_ENABLED) {
        const bonusMultiplier = Math.max(0, literalLimit - rank)
        finalScore = LITERAL_SCORE_BASE + LITERAL_SCORE_BONUS * bonusMultiplier + matchBonus
      }

      const snippet = buildSnippet(query, doc.rawContent || doc.content, SNIPPET_CHAR_LIMIT)

      results.push({
        slug: doc.slug,
        title: doc.title,
        snippet,
        score: Number(finalScore.toFixed(4)),
        literalScore: Number(normalizedScore.toFixed(4)),
        matchBonus: matchBonus > 0 ? Number(matchBonus.toFixed(4)) : undefined,
        rank,
        tags: doc.tags,
        aliases: doc.aliases,
        updated: doc.updated,
        url: this.options?.baseUrl ? new URL(doc.slug, this.options.baseUrl).toString() : undefined,
      })

      if (results.length >= limit) {
        break
      }
    }

    return results
  }

  async search(query: string, limit?: number): Promise<SearchResult[]> {
    const cleanQuery = query.trim()
    if (cleanQuery.length < MIN_QUERY_LENGTH) {
      return []
    }

    await this.ensureReady()
    if (!this.index) {
      throw new Error("Search index not ready")
    }

    const effectiveLimit = Math.max(1, limit ?? this.options?.limit ?? DEFAULT_LIMIT)

    const searchResults = (await this.index.searchAsync({
      query: cleanQuery,
      limit: effectiveLimit,
      index: ["title", "content", "aliases"],
    })) as DefaultDocumentSearchResults<SearchDoc>

    return this.aggregateResults(cleanQuery, searchResults, effectiveLimit)
  }

  getLastLoadedAt(): number | null {
    return this.lastLoadedAt
  }
}

const singleton = new WikiSearchService({
  indexPath: config.searchIndexPath,
  indexUrl: config.searchIndexUrl,
  baseUrl: config.searchBaseUrl,
  limit: config.searchResultLimit,
})

export const wikiSearchService = singleton
