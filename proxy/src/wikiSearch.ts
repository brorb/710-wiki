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
  tags: string[]
  aliases: string[]
  updated?: string
  url?: string
}

const DEFAULT_LIMIT = config.searchResultLimit ?? 8
const MIN_QUERY_LENGTH = 2
const CONTEXT_WINDOW_WORDS = 30

const DEFAULT_INDEX_CANDIDATES = [
  path.resolve(process.cwd(), "quartz-site/public/static/contentIndex.json"),
  path.resolve(process.cwd(), "quartz-site/public/contentIndex.json"),
  path.resolve(process.cwd(), "public/static/contentIndex.json"),
  path.resolve(process.cwd(), "public/contentIndex.json"),
]

const encoder = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)

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

const buildSnippet = (term: string, text: string): string => {
  if (!text) {
    return ""
  }
  const tokenizedText = text.split(/\s+/).filter((piece) => piece.length > 0)
  if (tokenizedText.length === 0) {
    return text.slice(0, 240)
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

  if (slice.length === text.length) {
    return slice
  }

  const prefix = windowStart === 0 ? "" : "…"
  const suffix = windowEnd === tokenizedText.length - 1 ? "" : "…"
  return `${prefix}${slice}${suffix}`
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

    this.index = document
    this.documents.clear()
    this.slugToDoc.clear()

    let nextId = 0
    const tasks: Array<Promise<unknown>> = []
    for (const [slug, entry] of Object.entries(data)) {
      const id = nextId++
      const aliases = normaliseAliases(entry.searchAliases)
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
      .slice(0, limit)

    const results: SearchResult[] = []
    for (const [id, meta] of sorted) {
      const doc = this.documents.get(id)
      if (!doc) {
        continue
      }
      results.push({
        slug: doc.slug,
        title: doc.title,
  snippet: buildSnippet(query, doc.rawContent || doc.content),
        score: Number(meta.score.toFixed(4)),
        tags: doc.tags,
        aliases: doc.aliases,
        updated: doc.updated,
        url: this.options?.baseUrl ? new URL(doc.slug, this.options.baseUrl).toString() : undefined,
      })
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
