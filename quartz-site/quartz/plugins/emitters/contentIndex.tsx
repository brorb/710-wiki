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

const LOG_PATH_SIGNATURE = ["content", "youtube", "videos", "7-10 tone"]

const LOG_NUMBER_REGEX = /\d+/g

function stripExtension(value: string): string {
  return value.replace(/\.[^.]+$/u, "")
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
  const lowered = normalized.toLowerCase()
  tokens.add(normalized)
  tokens.add(lowered)

  const digits = normalized.match(LOG_NUMBER_REGEX) ?? []
  for (const sequence of digits) {
    const trimmed = sequence.replace(/^0+(\d)/u, "$1")
    const padded = sequence.length <= 3 ? sequence.padStart(3, "0") : sequence
    const variants = new Set([sequence, padded, trimmed])
    for (const variant of variants) {
      if (!variant) continue
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

const RAW_LOG_ALIAS_MAP = (logAliasMapJson as Record<string, string[]>) || {}

const LOG_ALIAS_MAP: LogAliasMap = new Map(
  Object.entries(RAW_LOG_ALIAS_MAP).map(([rawKey, canonicalPieces]) => {
    const normalizedKey = stripExtension(rawKey).trim().toLowerCase()
    const aliasSet = new Set<string>()
    expandLogAlias(rawKey).forEach((alias) => aliasSet.add(alias))
    const stripped = stripExtension(rawKey)
    aliasSet.add(stripped)
    aliasSet.add(stripped.toLowerCase())
    for (const piece of canonicalPieces || []) {
      expandLogAlias(piece).forEach((alias) => aliasSet.add(alias))
    }
    return [normalizedKey, Array.from(aliasSet)]
  }),
)

function isLogRelativePath(relativePath: string | undefined): boolean {
  if (!relativePath) {
    return false
  }
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase()
  return LOG_PATH_SIGNATURE.every((segment) => normalized.includes(segment))
}

function buildSearchAliases(
  relativePath: string | undefined,
  logAliasMap: LogAliasMap,
): string[] | undefined {
  if (!isLogRelativePath(relativePath)) {
    return undefined
  }
  const base = stripExtension(basename(relativePath ?? ""))
  if (!base) {
    return undefined
  }

  const key = base.toLowerCase()
  const aliases = new Set<string>()
  const lookup = logAliasMap.get(key) ?? []
  for (const alias of lookup) {
    expandLogAlias(alias).forEach((variant) => aliases.add(variant))
  }

  // Always include raw filename variants for completeness
  expandLogAlias(base).forEach((variant) => aliases.add(variant))

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

      yield write({
        ctx,
        content: JSON.stringify(simplifiedIndex),
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
