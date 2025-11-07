import { Root } from "hast"
import { GlobalConfiguration } from "../../cfg"
import { getDate } from "../../components/Date"
import { escapeHTML } from "../../util/escape"
import { FilePath, FullSlug, SimpleSlug, joinSegments, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { toHtml } from "hast-util-to-html"
import { write } from "./helpers"
import { i18n } from "../../i18n"
// @ts-ignore – JSON import used for build-time alias hydration
import logAliasMapJson from "../../data/log_alias_map.json"

export type ContentIndexMap = Map<FullSlug, ContentDetails>
export type ContentDetails = {
  slug: FullSlug
  filePath: FilePath
  title: string
  links: SimpleSlug[]
  tags: string[]
  content: string
  richContent?: string
  date?: Date
  description?: string
  searchAliases?: string[]
}

export type SerializedContentDetails = Omit<ContentDetails, "date" | "description"> & {
  updated?: string
  searchAliases?: string[]
}

interface Options {
  enableSiteMap: boolean
  enableRSS: boolean
  rssLimit?: number
  rssFullHtml: boolean
  rssSlug: string
  includeEmptyFiles: boolean
}

const defaultOptions: Options = {
  enableSiteMap: true,
  enableRSS: true,
  rssLimit: 10,
  rssFullHtml: false,
  rssSlug: "index",
  includeEmptyFiles: true,
}

type LogAliasMap = Map<string, string[]>

const VIDEO_PATH_INDICATORS = ["youtube/videos", "youtube/livestreams"]
const MAX_ALIAS_OUTPUT = 80
const ALIAS_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/&/g, " and "],
  [/@/g, " at "],
  [/\+/g, " "],
  [/:/g, " "],
]

const REMOVABLE_EXTENSIONS = new Set([
  "md",
  "mdown",
  "mdx",
  "markdown",
  "txt",
  "html",
  "htm",
  "mp",
  "mp2",
  "mp3",
  "mp4",
  "mpeg",
  "mpg",
  "mpga",
  "mov",
  "avi",
  "wmv",
  "webm",
  "mkv",
  "m4a",
  "m4v",
  "wav",
  "flac",
  "aac",
  "ogg",
  "opus",
])

const LOG_NUMBER_REGEX = /\d+/g

function stripAllExtensions(value: string): string {
  let current = value
  while (true) {
    const match = current.match(/\.([^.]+)$/u)
    if (!match) {
      break
    }

    const ext = match[1]?.toLowerCase() ?? ""
    if (!REMOVABLE_EXTENSIONS.has(ext)) {
      break
    }

    current = current.slice(0, -match[0].length)
  }

  return current
}

function basename(value: string): string {
  const normalized = value.replace(/\\/g, "/")
  const parts = normalized.split("/")
  return parts.length > 0 ? parts[parts.length - 1] ?? value : value
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

function sanitizeUrlSegment(segment: string): string {
  const decoded = safeDecode(segment ?? "").trim()
  if (!decoded) {
    return ""
  }
  let normalized = decoded.replace(/'/g, "")
  normalized = normalized.replace(/\s+/g, "-")
  normalized = normalized.replace(/-+/g, "-")
  normalized = normalized.replace(/^-+/, "").replace(/-+$/, "")
  return normalized
}

function basicAliasForms(base: string): Set<string> {
  const forms = new Set<string>()
  const queue: string[] = [base]
  while (queue.length > 0) {
    const current = queue.pop() ?? ""
    if (forms.has(current)) {
      continue
    }
    forms.add(current)

    for (const [pattern, replacement] of ALIAS_SUBSTITUTIONS) {
      const replaced = current.replace(pattern, replacement)
      if (!forms.has(replaced)) {
        queue.push(replaced)
      }
      const stripped = current.replace(pattern, " ")
      if (!forms.has(stripped)) {
        queue.push(stripped)
      }
    }

    const withoutQuotes = current.replace(/'/g, "")
    if (!forms.has(withoutQuotes)) {
      queue.push(withoutQuotes)
    }

    const withoutParens = current.replace(/[()]+/g, " ")
    if (!forms.has(withoutParens)) {
      queue.push(withoutParens)
    }
  }
  return forms
}

function expandAliasVariants(raw: unknown): Set<string> {
  if (raw == null) {
    return new Set()
  }

  let base: string
  if (Array.isArray(raw)) {
    base = raw.map((item) => (item ?? "").toString()).join(" ")
  } else if (typeof raw === "object") {
    base = Object.values(raw as Record<string, unknown>)
      .map((value) => (value ?? "").toString())
      .join(" ")
  } else {
    base = raw.toString()
  }

  const trimmed = base.trim()
  if (!trimmed) {
    return new Set()
  }

  const variants = basicAliasForms(trimmed)
  const results = new Set<string>()
  for (const variant of variants) {
    const value = variant.trim()
    if (!value) {
      continue
    }
    results.add(value)
    results.add(value.toLowerCase())

    const collapsed = value.replace(/\s+/g, "")
    if (collapsed) {
      results.add(collapsed)
    }

    const hyphenated = value.replace(/\s+/g, "-")
    if (hyphenated) {
      results.add(hyphenated)
    }

    const underscored = value.replace(/\s+/g, "_")
    if (underscored) {
      results.add(underscored)
    }

    const spaced = value.replace(/[-_/]+/g, " ").trim()
    if (spaced) {
      results.add(spaced)
    }

    const stripped = value.replace(/[^a-z0-9]+/gi, "").toLowerCase()
    if (stripped) {
      results.add(stripped)
    }

    const pieces = value.split(/[\s_\-/.]+/).filter((piece) => piece.length >= 2)
    for (const piece of pieces) {
      results.add(piece)
      results.add(piece.toLowerCase())
    }
  }

  return new Set(Array.from(results).filter((candidate) => candidate.length > 0))
}

function addAliasVariants(target: Set<string>, raw: unknown) {
  const variants = expandAliasVariants(raw)
  for (const variant of variants) {
    target.add(variant)
  }
}

function addPathAliases(target: Set<string>, relativePath: string | undefined) {
  if (!relativePath) {
    return
  }
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\/+/, "")
  if (!normalized) {
    return
  }

  addAliasVariants(target, normalized)
  const withoutExt = stripAllExtensions(normalized)
  if (withoutExt && withoutExt !== normalized) {
    addAliasVariants(target, withoutExt)
  }

  const segments = normalized.split("/").filter(Boolean)
  const sanitizedSegments = segments.map((segment) => sanitizeUrlSegment(segment)).filter(Boolean)
  if (sanitizedSegments.length > 0) {
    addAliasVariants(target, sanitizedSegments.join("/"))
  }
  for (const [index, segment] of sanitizedSegments.entries()) {
    addAliasVariants(target, segment)
    if (index === sanitizedSegments.length - 1) {
      addAliasVariants(target, segment.replace(/[^a-z0-9]+/gi, ""))
    }
  }
}

function expandLogAlias(label: string): string[] {
  const normalized = label.trim()
  if (normalized.length === 0) {
    return []
  }

  const tokens = new Set<string>()
  const addVariant = (candidate: string) => {
    const trimmed = candidate.trim()
    if (!trimmed) {
      return
    }
    tokens.add(trimmed)
    tokens.add(trimmed.toLowerCase())
  }

  addVariant(normalized)

  const separatorsToSpace = normalized.replace(/[_-]+/g, " ")
  addVariant(separatorsToSpace)

  const punctuationToSpace = normalized.replace(/[^\p{L}\p{N}\s]+/gu, " ")
  addVariant(punctuationToSpace)

  const collapsedWhitespace = punctuationToSpace.replace(/\s+/g, " ").trim()
  if (collapsedWhitespace) {
    addVariant(collapsedWhitespace)
    const segments = collapsedWhitespace.split(" ").filter(Boolean)
    if (segments.length > 1) {
      addVariant(segments.join("-"))
      addVariant(segments.join("_"))
      addVariant(segments.join(""))
    } else if (segments.length === 1) {
      addVariant(segments[0])
    }
  }

  const digits = normalized.match(LOG_NUMBER_REGEX) ?? []
  const includeLogPrefixes = digits.length > 0
  for (const sequence of digits) {
    const trimmedSequence = sequence.replace(/^0+(\d)/u, "$1") || sequence
    const padded = sequence.length <= 3 ? sequence.padStart(3, "0") : sequence
    const variants = new Set([sequence, trimmedSequence, padded])
    for (const variant of variants) {
      if (!variant) {
        continue
      }
      addVariant(variant)
      if (includeLogPrefixes) {
        addVariant(`log ${variant}`)
        addVariant(`log-${variant}`)
        addVariant(`log${variant}`)
        addVariant(`log_${variant}`)
      }
    }
  }

  return Array.from(tokens)
}

const RAW_LOG_ALIAS_MAP = (logAliasMapJson as Record<string, string[]>) || {}

const LOG_ALIAS_MAP: LogAliasMap = new Map(
  Object.entries(RAW_LOG_ALIAS_MAP).map(([rawKey, canonicalPieces]) => {
    const canonicalKey = stripAllExtensions(rawKey).trim()
    const normalizedKey = canonicalKey.toLowerCase()
    const aliasSet = new Set<string>()

    if (canonicalKey.length > 0) {
      aliasSet.add(canonicalKey)
      aliasSet.add(canonicalKey.toLowerCase())
      expandLogAlias(canonicalKey).forEach((alias) => aliasSet.add(alias))
    }

    const rawLiteral = rawKey.trim()
    if (rawLiteral.length > 0 && rawLiteral !== canonicalKey) {
      aliasSet.add(rawLiteral)
      aliasSet.add(rawLiteral.toLowerCase())
    }

    for (const piece of canonicalPieces || []) {
      const trimmedPiece = piece?.trim() ?? ""
      if (!trimmedPiece) {
        continue
      }
      const canonicalPiece = stripAllExtensions(trimmedPiece)
      if (canonicalPiece.length > 0) {
        aliasSet.add(canonicalPiece)
        aliasSet.add(canonicalPiece.toLowerCase())
        expandLogAlias(canonicalPiece).forEach((alias) => aliasSet.add(alias))
      }
      if (canonicalPiece !== trimmedPiece) {
        aliasSet.add(trimmedPiece)
        aliasSet.add(trimmedPiece.toLowerCase())
      }
    }

    return [normalizedKey, Array.from(aliasSet)]
  }),
)

function shouldGenerateVideoAliases(relativePath: string | undefined): boolean {
  if (!relativePath) {
    return false
  }
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase()
  return VIDEO_PATH_INDICATORS.some((indicator) => normalized.includes(indicator))
}

function buildSearchAliases(
  slug: FullSlug,
  relativePath: string | undefined,
  title: string | undefined,
  frontmatterAliases: unknown[] | undefined,
  logAliasMap: LogAliasMap,
): string[] | undefined {
  const aliases = new Set<string>()

  addAliasVariants(aliases, slug)
  addAliasVariants(aliases, title)
  if (frontmatterAliases) {
    for (const candidate of frontmatterAliases) {
      addAliasVariants(aliases, candidate)
    }
  }
  addPathAliases(aliases, relativePath)

  if (shouldGenerateVideoAliases(relativePath)) {
    const fileName = basename(relativePath ?? "")
    const sanitizedBase = stripAllExtensions(fileName)
    if (sanitizedBase) {
      const key = sanitizedBase.toLowerCase()
      const lookup = logAliasMap.get(key) ?? []
      lookup.forEach((alias) => addAliasVariants(aliases, alias))
      expandLogAlias(sanitizedBase).forEach((variant) => addAliasVariants(aliases, variant))
    }
  }

  const aliasList = Array.from(aliases)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0)

  if (aliasList.length === 0) {
    return undefined
  }

  const deduped = Array.from(new Set(aliasList))
  deduped.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length
    }
    return a.localeCompare(b)
  })

  return deduped.slice(0, MAX_ALIAS_OUTPUT)
}

function generateSiteMap(cfg: GlobalConfiguration, idx: ContentIndexMap): string {
  const base = cfg.baseUrl ?? ""
  const createURLEntry = (slug: SimpleSlug, content: ContentDetails): string => `<url>
    <loc>https://${joinSegments(base, encodeURI(slug))}</loc>
    ${content.date && `<lastmod>${content.date.toISOString()}</lastmod>`}
  </url>`
  const urls = Array.from(idx)
    .map(([slug, content]) => createURLEntry(simplifySlug(slug), content))
    .join("")
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`
}

const MAX_RSS_ITEMS = 100

function generateRSSFeed(cfg: GlobalConfiguration, idx: ContentIndexMap, limit?: number): string {
  const base = cfg.baseUrl ?? ""
  const effectiveLimit = Math.min(limit ?? MAX_RSS_ITEMS, MAX_RSS_ITEMS)

  const createURLEntry = (slug: SimpleSlug, content: ContentDetails): string => `<item>
    <title>${escapeHTML(content.title)}</title>
    <link>https://${joinSegments(base, encodeURI(slug))}</link>
    <guid>https://${joinSegments(base, encodeURI(slug))}</guid>
    <description><![CDATA[ ${content.richContent ?? content.description} ]]></description>
    <pubDate>${content.date?.toUTCString()}</pubDate>
  </item>`

  const items = Array.from(idx)
    .sort(([_, f1], [__, f2]) => {
      if (f1.date && f2.date) {
        return f2.date.getTime() - f1.date.getTime()
      } else if (f1.date && !f2.date) {
        return -1
      } else if (!f1.date && f2.date) {
        return 1
      }

      return f1.title.localeCompare(f2.title)
    })
    .map(([slug, content]) => createURLEntry(simplifySlug(slug), content))
    .slice(0, effectiveLimit)
    .join("")

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
    <channel>
      <title>${escapeHTML(cfg.pageTitle)}</title>
      <link>https://${base}</link>
      <description>${limit !== undefined ? i18n(cfg.locale).pages.rss.lastFewNotes({ count: effectiveLimit }) : i18n(cfg.locale).pages.rss.recentNotes} on ${escapeHTML(
        cfg.pageTitle,
      )}</description>
      <generator>Quartz -- quartz.jzhao.xyz</generator>
      ${items}
    </channel>
  </rss>`
}

export const ContentIndex: QuartzEmitterPlugin<Partial<Options>> = (opts) => {
  opts = { ...defaultOptions, ...opts }
  const logAliasMap = LOG_ALIAS_MAP
  return {
    name: "ContentIndex",
    async *emit(ctx, content) {
      const cfg = ctx.cfg.configuration
      const linkIndex: ContentIndexMap = new Map()
      for (const [tree, file] of content) {
        const slug = file.data.slug!
        const date = getDate(ctx.cfg.configuration, file.data) ?? new Date()
        if (opts?.includeEmptyFiles || (file.data.text && file.data.text !== "")) {
          const frontmatter = (file.data.frontmatter ?? {}) as Record<string, unknown>
          const title = (frontmatter["title"] as string | undefined) ?? slug
          const frontmatterAliasCandidates: unknown[] = []
          if (frontmatter["aliases"] !== undefined) {
            frontmatterAliasCandidates.push(frontmatter["aliases"])
          }
          if (frontmatter["alias"] !== undefined) {
            frontmatterAliasCandidates.push(frontmatter["alias"])
          }
          if (frontmatter["aka"] !== undefined) {
            frontmatterAliasCandidates.push(frontmatter["aka"])
          }
          if (frontmatter["searchAliases"] !== undefined) {
            frontmatterAliasCandidates.push(frontmatter["searchAliases"])
          }

          const frontmatterAliases = frontmatterAliasCandidates.length > 0 ? frontmatterAliasCandidates : undefined

          linkIndex.set(slug, {
            slug,
            filePath: file.data.relativePath!,
            title,
            links: file.data.links ?? [],
            tags: file.data.frontmatter?.tags ?? [],
            content: file.data.text ?? "",
            richContent: opts?.rssFullHtml
              ? escapeHTML(toHtml(tree as Root, { allowDangerousHtml: true }))
              : undefined,
            date: date,
            description: file.data.description ?? "",
            searchAliases: buildSearchAliases(
              slug,
              file.data.relativePath,
              title,
              frontmatterAliases,
              logAliasMap,
            ),
          })
        }
      }

      if (opts?.enableSiteMap) {
        yield write({
          ctx,
          content: generateSiteMap(cfg, linkIndex),
          slug: "sitemap" as FullSlug,
          ext: ".xml",
        })
      }

      if (opts?.enableRSS) {
        yield write({
          ctx,
          content: generateRSSFeed(cfg, linkIndex, opts.rssLimit),
          slug: (opts?.rssSlug ?? "index") as FullSlug,
          ext: ".xml",
        })
      }

      const fp = joinSegments("static", "contentIndex") as FullSlug
      const simplifiedEntries: [FullSlug, SerializedContentDetails][] = Array.from(linkIndex).map(
        ([slug, content]) => {
          const { date, description: _description, ...rest } = content
          return [
            slug,
            {
              ...rest,
              updated: date?.toISOString(),
              searchAliases: content.searchAliases,
            },
          ]
        },
      )

      const simplifiedIndex = Object.fromEntries(simplifiedEntries)

      const jsonOutput = JSON.stringify(simplifiedIndex, null, 2)

      yield write({
        ctx,
        content: `${jsonOutput}\n`,
        slug: fp,
        ext: ".json",
      })
    },
    externalResources: (ctx) => {
      if (opts?.enableRSS) {
        return {
          additionalHead: [
            <link
              rel="alternate"
              type="application/rss+xml"
              title="RSS Feed"
              href={`https://${ctx.cfg.configuration.baseUrl}/index.xml`}
            />,
          ],
        }
      }
    },
  }
}
