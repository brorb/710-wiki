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
  relativePath: string | undefined,
  logAliasMap: LogAliasMap,
): string[] | undefined {
  if (!shouldGenerateVideoAliases(relativePath)) {
    return undefined
  }
  const fileName = basename(relativePath ?? "")
  const sanitizedBase = stripAllExtensions(fileName)
  if (!sanitizedBase) {
    return undefined
  }

  const key = sanitizedBase.toLowerCase()
  const aliases = new Set<string>()
  const lookup = logAliasMap.get(key) ?? []
  for (const alias of lookup) {
    aliases.add(alias)
  }

  expandLogAlias(sanitizedBase).forEach((variant) => aliases.add(variant))

  const literalBase = sanitizedBase.trim()
  if (literalBase) {
    aliases.add(literalBase)
    aliases.add(literalBase.toLowerCase())
  }

  return aliases.size > 0 ? Array.from(aliases) : undefined
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
          linkIndex.set(slug, {
            slug,
            filePath: file.data.relativePath!,
            title: file.data.frontmatter?.title!,
            links: file.data.links ?? [],
            tags: file.data.frontmatter?.tags ?? [],
            content: file.data.text ?? "",
            richContent: opts?.rssFullHtml
              ? escapeHTML(toHtml(tree as Root, { allowDangerousHtml: true }))
              : undefined,
            date: date,
            description: file.data.description ?? "",
            searchAliases: buildSearchAliases(file.data.relativePath, logAliasMap),
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
