import path from "node:path"
import fs, { existsSync } from "node:fs"
import fsp from "node:fs/promises"
import { globbySync } from "globby"
import { QuartzTransformerPlugin } from "../types"
import { getAssetVersion } from "../../util/assetVersion"
import { FilePath, FullSlug, joinSegments, pathToRoot, slugifyFilePath } from "../../util/path"

type MdNode = {
  type?: string
  value?: unknown
  lang?: string
  depth?: number
  children?: MdNode[]
  meta?: string
  [key: string]: unknown
}

type MdParent = MdNode & {
  children: MdNode[]
}

const TARGET_SLUG = "youtube/community-posts"

interface ChannelProfile {
  name: string
  avatar: string
}

const DEFAULT_CHANNEL_HANDLE = "7-10tone"

const CONTENT_ROOT = path.resolve(process.cwd(), "../Content")
const CACHE_DIR = path.resolve(process.cwd(), ".quartz-cache")
const CACHE_FILE = path.join(CACHE_DIR, "youtube-channels.json")
const AVATAR_RELATIVE_DIR = "Media/Avatars"
const AVATAR_DIR = path.resolve(CONTENT_ROOT, AVATAR_RELATIVE_DIR)

// Ensure directories exist
if (!existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}
if (!existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true })
}

let memoryCache: Record<string, ChannelProfile> | null = null

const loadCache = async (): Promise<Record<string, ChannelProfile>> => {
  if (memoryCache) return memoryCache
  try {
    const data = await fsp.readFile(CACHE_FILE, "utf-8")
    memoryCache = JSON.parse(data)
  } catch {
    memoryCache = {}
  }
  return memoryCache!
}

const saveCache = async () => {
  if (memoryCache) {
    await fsp.writeFile(CACHE_FILE, JSON.stringify(memoryCache, null, 2))
  }
}

const downloadImage = async (url: string, destPath: string) => {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })
    if (!res.ok) {
       console.warn(`[YouTubeCommunityPosts] Failed to fetch image ${url}: ${res.statusText}`)
       return
    }
    const buffer = await res.arrayBuffer()
    await fsp.writeFile(destPath, Buffer.from(buffer))
  } catch (err) {
    console.warn(`[YouTubeCommunityPosts] Failed to download image from ${url}`, err)
  }
}

const fetchChannelData = async (handle: string): Promise<ChannelProfile | null> => {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })
    if (!res.ok) return null
    const html = await res.text()

    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/)
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)">/)

    if (!titleMatch || !imageMatch) return null

    const name = titleMatch[1]
    const imageUrl = imageMatch[1]

    let ext = "jpg"
    if (imageUrl.includes(".png")) ext = "png"
    
    // Clean up filename
    const safeHandle = handle.replace(/[^a-zA-Z0-9_\-]/g, "")
    const avatarFilename = `${safeHandle}.${ext}`
    const localAvatarPath = `${AVATAR_RELATIVE_DIR}/${avatarFilename}`
    const absoluteAvatarPath = path.join(AVATAR_DIR, avatarFilename)

    await downloadImage(imageUrl, absoluteAvatarPath)

    return {
      name,
      avatar: localAvatarPath,
    }
  } catch (err) {
    console.warn(`[YouTubeCommunityPosts] Failed to fetch channel @${handle}`, err)
    return null
  }
}

const getChannelProfile = async (handle: string): Promise<ChannelProfile> => {
  const cache = await loadCache()
  const normalizedKey = handle.toLowerCase()

  if (cache[normalizedKey]) {
    return cache[normalizedKey]
  }

  // Pre-seed defaults if desired, or just fetch
  if (normalizedKey === "7-10tone" && !cache[normalizedKey]) {
      cache[normalizedKey] = {
        name: "7/10 Tone",
        avatar: "Media/710 Media/Images/710 tone pfp small.jpg"
      }
      return cache[normalizedKey]
  }
  
  console.log(`[YouTubeCommunityPosts] Fetching channel data for: @${handle}`)
  const profile = await fetchChannelData(handle)

  if (profile) {
    cache[normalizedKey] = profile
    await saveCache()
    return profile
  }

  return {
    name: `@${handle}`,
    avatar: "Media/Avatars/default.jpg", 
  }
}

const assetLookupCache = new Map<string, string | null>()

const isExternalUrl = (url: string): boolean => /^(https?:)?\/\//i.test(url)

const stripContentPrefix = (target: string): string =>
  target.replace(/^[./]+/, "").replace(/^content\//i, "")

const findAssetByBasename = (basename: string): string | undefined => {
  const key = basename.toLowerCase()
  if (assetLookupCache.has(key)) {
    const cached = assetLookupCache.get(key)
    return cached === null ? undefined : cached
  }

  const matches = globbySync(`**/${basename}`, {
    cwd: CONTENT_ROOT,
    caseSensitiveMatch: false,
    onlyFiles: true,
  })

  if (matches.length === 0) {
    assetLookupCache.set(key, null)
    return undefined
  }

  matches.sort((a, b) => a.length - b.length || a.localeCompare(b))
  const resolved = matches[0].replace(/\\/g, "/")
  assetLookupCache.set(key, resolved)
  return resolved
}

const resolveObsidianTarget = (rawTarget: string, slug: FullSlug): string => {
  if (isExternalUrl(rawTarget)) {
    return rawTarget
  }

  let targetPath = stripContentPrefix(rawTarget)
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath)
    if (matched) {
      targetPath = matched
    }
  }

  const targetWithoutExt = targetPath as FilePath
  const targetSlug = slugifyFilePath(targetWithoutExt)
  const baseDir = pathToRoot(slug)
  const resolved = joinSegments(baseDir, targetSlug)
  const version = getAssetVersion()
  return version ? `${resolved}?v=${version}` : resolved
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const escapeAttribute = (value: string): string => escapeHtml(value)

const collectText = (node: MdNode | undefined): string => {
  if (!node || typeof node !== "object") {
    return ""
  }

  if (typeof node.value === "string") {
    return node.value
  }

  if (Array.isArray(node.children)) {
    return node.children.map((child) => collectText(child)).join("")
  }

  return ""
}

interface EmbedSegment {
  type: "embed"
  target: string
  alias?: string
}

interface TextSegment {
  type: "text"
  content: string
}

type Segment = EmbedSegment | TextSegment

interface PostMetadata {
  likes?: number
  comments?: number
  postedLabel?: string
  channelHandle?: string
}

const EMBED_REGEX = /!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g

const METADATA_LINE_REGEX = /^\s*(?:@([a-zA-Z0-9_\-]+)\s*,\s*)?(\d+)\s*,\s*(\d+)\s*,\s*([^,\n]+?)(?:\s*,\s*)?(?:\r?\n|$)/i
const COMMUNITY_POST_PREFIX_REGEX = /^\s*community-post\s*,/i

interface CommunityPostHeaderResult {
  metadata: PostMetadata
  inlineBody?: string
}

const parseCommunityPostHeader = (raw?: string): CommunityPostHeaderResult | null => {
  if (!raw) {
    return null
  }

  const trimmed = raw.trim()
  if (!COMMUNITY_POST_PREFIX_REGEX.test(trimmed)) {
    return null
  }

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part, index, array) => {
      if (part.length === 0 && index >= array.length - 1) {
        return false
      }
      return true
    })

  // Basic check: at least "community-post, likes, comments, date"
  if (parts.length < 4) {
    return null
  }

  let argIndex = 1
  let channelHandle = DEFAULT_CHANNEL_HANDLE

  // Check for @handle at parts[1]
  if (parts[1] && parts[1].startsWith("@")) {
    channelHandle = parts[1].slice(1).toLowerCase()
    argIndex++
  }

  // Ensure enough parts remain
  if (parts.length < argIndex + 2) {
    return null
  }

  const likes = Number.parseInt(parts[argIndex] ?? "", 10)
  const comments = Number.parseInt(parts[argIndex + 1] ?? "", 10)
  
  if (!Number.isFinite(likes) || !Number.isFinite(comments)) {
    return null
  }

  let postedLabelRaw = parts[argIndex + 2] ?? ""
  const inlineSegments = parts.slice(argIndex + 3).filter((segment) => segment.length > 0)

  if ((!postedLabelRaw || /^[0-9]+$/.test(postedLabelRaw)) && inlineSegments.length > 0) {
    const candidate = inlineSegments[0]
    if (candidate && /[A-Za-z]/.test(candidate)) {
      postedLabelRaw = `${postedLabelRaw} ${candidate}`.trim()
      inlineSegments.shift()
    } else if (!postedLabelRaw) {
      postedLabelRaw = candidate
      inlineSegments.shift()
    }
  } else if (
    postedLabelRaw &&
    inlineSegments.length > 0 &&
    /[A-Za-z]/.test(postedLabelRaw) &&
    !/\d{4}/.test(postedLabelRaw)
  ) {
    const candidate = inlineSegments[0]
    if (/^\d{4}$/.test(candidate)) {
      postedLabelRaw = `${postedLabelRaw} ${candidate}`.trim()
      inlineSegments.shift()
    }
  }

  const inlineBody = inlineSegments.join(",").trim()
  const metadata: PostMetadata = {}
  metadata.likes = likes
  metadata.comments = comments
  metadata.channelHandle = channelHandle

  if (postedLabelRaw.length > 0) {
    metadata.postedLabel = postedLabelRaw
  }

  return {
    metadata,
    inlineBody: inlineBody.length > 0 ? inlineBody : undefined,
  }
}

const splitSegments = (raw: string): Segment[] => {
  EMBED_REGEX.lastIndex = 0
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = EMBED_REGEX.exec(raw)) !== null) {
    const [whole, target, alias] = match
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: raw.slice(lastIndex, match.index) })
    }

    segments.push({ type: "embed", target: target.trim(), alias: alias?.trim() })
    lastIndex = match.index + whole.length
  }

  if (lastIndex < raw.length) {
    segments.push({ type: "text", content: raw.slice(lastIndex) })
  }

  return segments
}

const normaliseWhitespace = (segment: string): string => segment.replace(/\r\n?/g, "\n")

const toSentenceCase = (input: string): string => {
  if (!input) {
    return ""
  }

  const cleaned = input.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) {
    return ""
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

const parseNumericAlias = (alias?: string): number | undefined => {
  if (!alias) {
    return undefined
  }

  const numeric = Number.parseInt(alias.replace(/[^0-9]/g, ""), 10)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
}

const parseMetadataMatch = (match: RegExpMatchArray | null): PostMetadata => {
  if (!match) {
    return {}
  }

  const [, handleRaw, likesRaw, commentsRaw, labelRaw] = match
  const likes = Number.parseInt(likesRaw, 10)
  const comments = Number.parseInt(commentsRaw, 10)
  const postedLabel = labelRaw.trim()

  const metadata: PostMetadata = {}
  if (Number.isFinite(likes)) {
    metadata.likes = likes
  }
  if (Number.isFinite(comments)) {
    metadata.comments = comments
  }
  if (postedLabel.length > 0) {
    metadata.postedLabel = postedLabel
  }
  if (handleRaw) {
    metadata.channelHandle = handleRaw.toLowerCase()
  }

  return metadata
}

const parseBodyMetadata = (raw: string): { metadata: PostMetadata; body: string } => {
  const match = raw.match(METADATA_LINE_REGEX)
  if (!match) {
    return { metadata: {}, body: raw }
  }

  const metadata = parseMetadataMatch(match)
  const body = raw.slice(match[0].length)
  return { metadata, body }
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const ORDINAL_SUFFIX_REGEX = /\b(\d{1,2})(?:st|nd|rd|th)\b/gi
const TRAILING_PUNCTUATION_REGEX = /[.,]+$/

const DATE_WITH_DAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

const DATE_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
})

const getMonthIndex = (value: string): number | undefined => MONTH_INDEX[value.toLowerCase()]

const padTwo = (value: number): string => (value < 10 ? `0${value}` : `${value}`)
const padYear = (value: number): string => value.toString().padStart(4, "0")

const formatPostedLabel = (
  rawLabel: string,
  fallbackYear?: string,
): { display: string; iso?: string } => {
  const base = rawLabel
    .replace(ORDINAL_SUFFIX_REGEX, "$1")
    .replace(TRAILING_PUNCTUATION_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!base) {
    return { display: "" }
  }

  const dayMonthYearMatch = base.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (dayMonthYearMatch) {
    const [, dayRaw, monthRaw, yearRaw] = dayMonthYearMatch
    const monthIndex = getMonthIndex(monthRaw)
    if (monthIndex !== undefined) {
      const year = Number.parseInt(yearRaw, 10)
      const day = Number.parseInt(dayRaw, 10)
      if (Number.isFinite(year) && Number.isFinite(day)) {
        const date = new Date(Date.UTC(year, monthIndex, day))
        return {
          display: DATE_WITH_DAY_FORMATTER.format(date),
          iso: `${yearRaw}-${padTwo(monthIndex + 1)}-${padTwo(day)}`,
        }
      }
    }
  }

  const dayMonthMatch = base.match(/^(\d{1,2})\s+([A-Za-z]+)$/)
  if (dayMonthMatch && fallbackYear) {
    const [, dayRaw, monthRaw] = dayMonthMatch
    const monthIndex = getMonthIndex(monthRaw)
    if (monthIndex !== undefined) {
      const year = Number.parseInt(fallbackYear, 10)
      const day = Number.parseInt(dayRaw, 10)
      if (Number.isFinite(year) && Number.isFinite(day)) {
        const date = new Date(Date.UTC(year, monthIndex, day))
        return {
          display: DATE_WITH_DAY_FORMATTER.format(date),
          iso: `${padYear(year)}-${padTwo(monthIndex + 1)}-${padTwo(day)}`,
        }
      }
    }
  }

  const monthYearMatch = base.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (monthYearMatch) {
    const [, monthRaw, yearRaw] = monthYearMatch
    const monthIndex = getMonthIndex(monthRaw)
    if (monthIndex !== undefined) {
      const year = Number.parseInt(yearRaw, 10)
      if (Number.isFinite(year)) {
        const date = new Date(Date.UTC(year, monthIndex, 1))
        return {
          display: DATE_MONTH_YEAR_FORMATTER.format(date),
          iso: `${yearRaw}-${padTwo(monthIndex + 1)}-01`,
        }
      }
    }
  }

  const yearMatch = base.match(/^(\d{4})$/)
  if (yearMatch) {
    const [, yearRaw] = yearMatch
    return {
      display: yearRaw,
      iso: yearRaw,
    }
  }

  if (fallbackYear && !/\d{4}/.test(base)) {
    const combined = `${base} ${fallbackYear}`
    const attempt = formatPostedLabel(combined, undefined)
    if (attempt.display) {
      return attempt
    }
  }

  return { display: base }
}

const formatCount = (value: number | undefined): string | undefined => {
  if (value === undefined || Number.isNaN(value) || value < 0) {
    return undefined
  }

  return value.toLocaleString("en-US")
}

const normaliseFragment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")

const toOptionalFragment = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined
  }

  const fragment = normaliseFragment(value)
  return fragment.length > 0 ? fragment : undefined
}

const createShareSnippet = (raw?: string): string | undefined => {
  if (!raw) {
    return undefined
  }

  const cleaned = raw.replace(/\s+/g, " ").trim()
  if (!cleaned) {
    return undefined
  }

  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned
}

let communityPostSequence = 0

const buildPostAnchorId = (
  slug: FullSlug,
  metadata: PostMetadata,
  snippet?: string,
): string => {
  const slugFragment = toOptionalFragment(slug)
  let base = [metadata.postedLabel, snippet]
    .map(toOptionalFragment)
    .find((fragment) => fragment)

  if (base) {
    if (!base.startsWith("youtube-post")) {
      base = `youtube-post-${base}`
    }
  } else {
    base = "youtube-post"
  }

  if (slugFragment && !base.startsWith(`${slugFragment}-`)) {
    base = `${slugFragment}-${base}`
  }

  const sequence = (communityPostSequence++).toString(36)
  return `${base}-${sequence}`
}

const renderTextSegment = (segment: TextSegment): string => {
  const content = normaliseWhitespace(segment.content).replace(/^\s+/, "").replace(/\s+$/, "")
  if (!content) {
    return ""
  }

  const safe = escapeHtml(content).replace(/\n/g, "<br />")
  return `<div class="yt-community-post__text">${safe}</div>`
}

const renderEmbedSegment = (segment: EmbedSegment, slug: FullSlug, channelName: string): string => {
  if (!segment.target) {
    return ""
  }

  const src = resolveObsidianTarget(segment.target, slug)
  const width = parseNumericAlias(segment.alias)
  const fallbackAlt = toSentenceCase(segment.target.split("/").pop() ?? "") || channelName
  const aliasAlt = width ? undefined : segment.alias
  const alt = escapeAttribute((aliasAlt && aliasAlt.length > 0 ? aliasAlt : fallbackAlt) || channelName)
  const styles: string[] = []
  if (width) {
    styles.push(`max-width: ${width}px`)
  }

  const styleAttr = styles.length > 0 ? ` style="${escapeAttribute(styles.join("; "))}"` : ""

  return `<figure class="yt-community-post__embed">
    <img src="${escapeAttribute(src)}" alt="${alt}" loading="lazy" decoding="async"${styleAttr} />
  </figure>`
}

const renderSegments = (segments: Segment[], slug: FullSlug, channelName: string): string => {
  return segments
    .map((segment) => {
      if (segment.type === "text") {
        return renderTextSegment(segment)
      }
      return renderEmbedSegment(segment, slug, channelName)
    })
    .filter((html) => html.length > 0)
    .join("\n")
}

const renderPost = (options: {
  content: string
  year?: string
  slug: FullSlug
  metadataHint?: PostMetadata
  channelProfile: ChannelProfile
}): string => {
  const { content, year, slug, metadataHint, channelProfile } = options
  const trimmed = content.replace(/^\s+|\s+$/g, "")
  if (!trimmed) {
    return ""
  }

  const { metadata: bodyMetadata, body } = parseBodyMetadata(trimmed)
  const metadata: PostMetadata = {
    ...metadataHint,
    ...bodyMetadata,
  }

  const channelName = channelProfile.name
  const avatarSrc = resolveObsidianTarget(channelProfile.avatar, slug)

  const cleanedBody = body.replace(/^\s+/, "")
  const segments = splitSegments(cleanedBody)
  const bodyHtml = renderSegments(segments, slug, channelName)
  let postedDisplay = metadata.postedLabel?.trim() || ""
  let dataPosted: string | undefined
  if (postedDisplay) {
    const formatted = formatPostedLabel(postedDisplay, year)
    postedDisplay = formatted.display || postedDisplay
    if (formatted.iso) {
      dataPosted = formatted.iso
    }
    metadata.postedLabel = postedDisplay
  }

  const timestamp = postedDisplay
    ? `Posted ${escapeHtml(postedDisplay)}`
    : year
      ? `Posted ${escapeHtml(year)}`
      : "Posted"

  const likeCount = formatCount(metadata.likes)
  const commentCount = formatCount(metadata.comments)
  if (!dataPosted) {
    dataPosted = postedDisplay || year || ""
  }

  const textSegments = segments
    .filter((segment): segment is TextSegment => segment.type === "text")
    .map((segment) => normaliseWhitespace(segment.content))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  const shareSnippet = createShareSnippet(textSegments || metadata.postedLabel || undefined)
  const anchorId = buildPostAnchorId(slug, metadata, shareSnippet)
  const shareLabel = metadata.postedLabel || year
    ? `Share YouTube community post (${metadata.postedLabel ?? year})`
    : "Share YouTube community post"

  const shareAttributes: string[] = [
    'type="button"',
    'class="yt-community-post__share article-share__button"',
    `aria-label="${escapeAttribute(shareLabel)}"`,
    `data-share-url="#${escapeAttribute(anchorId)}"`,
    `data-share-title="${escapeAttribute(`${channelName} community post`)}"`,
  ]

  if (shareSnippet) {
    shareAttributes.push(`data-share-text="${escapeAttribute(shareSnippet)}"`)
  }

  shareAttributes.push('data-share-copied="URL copied"')

  const shareMarkup = `<div class="yt-community-post__share-container article-share">
      <button ${shareAttributes.join(" ")}>
        <span class="yt-community-post__share-icon" aria-hidden="true"></span>
      </button>
      <span class="article-share__feedback" aria-live="polite"></span>
    </div>`

  const bodySection = bodyHtml.trim().length
    ? `<div class="yt-community-post__body">
      ${bodyHtml}
    </div>`
    : ""

  return `<article class="yt-community-post" id="${escapeAttribute(anchorId)}" data-posted="${escapeAttribute(dataPosted)}">
  <span class="yt-community-post__avatar">
    <img src="${escapeAttribute(avatarSrc)}" alt="${escapeAttribute(channelName)}" loading="lazy" width="48" height="48" />
  </span>
  <div class="yt-community-post__content">
    <div class="yt-community-post__header">
      <div class="yt-community-post__identity">
        <span class="yt-community-post__channel">${escapeHtml(channelName)}</span>
        <span class="yt-community-post__timestamp">${timestamp}</span>
      </div>
      ${shareMarkup}
    </div>
    ${bodySection}
    <footer class="yt-community-post__footer">
      <div class="yt-community-post__actions" aria-hidden="true">
        <span class="yt-community-post__action">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14 1 7.59 7.41C7.22 7.78 7 8.3 7 8.83V19c0 1.1.9 2 2 2h8c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
          ${likeCount !== undefined ? `<span class="yt-community-post__count">${escapeHtml(likeCount)}</span>` : ""}
        </span>
        <span class="yt-community-post__action">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12l5 4V5c0-1.1-.9-2-2-2h-3z" /></svg>
          ${commentCount !== undefined ? `<span class="yt-community-post__count">${escapeHtml(commentCount)}</span>` : ""}
        </span>
      </div>
    </footer>
  </div>
</article>`
}

const YT_COMMUNITY_CSS = `
.yt-community-post {
  background: #202020;
  border: 1px solid #2f2f2f;
  border-radius: 16px;
  padding: 13px 18px 16px;
  color: #f1f1f1;
  max-width: min(640px, 100%);
  font-family: "Roboto", "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  scroll-margin-top: 120px;
  transition: box-shadow 0.24s ease;
}

.yt-community-post + .yt-community-post {
  margin-top: 20px;
}

.yt-community-post__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  row-gap: 4px;
  flex-wrap: wrap;
  width: 100%;
}
.yt-community-post__identity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  line-height: 1;
}
.yt-community-post__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.yt-community-post__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.yt-community-post__channel {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1;
}

.yt-community-post__timestamp {
  color: #a7a7a7;
  font-size: 0.78rem;
  line-height: 1;
}

.yt-community-post__share-container.article-share {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.yt-community-post__share-container.article-share .article-share__feedback {
  min-height: 0.8rem;
  text-align: right;
}

.yt-community-post__share.article-share__button {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
  transition: background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
}

.yt-community-post:hover .yt-community-post__share.article-share__button,
.yt-community-post__share.article-share__button:focus-visible {
  opacity: 1;
}

.yt-community-post__share.article-share__button:hover {
  color: var(--color-accent-deep);
}

.yt-community-post__share.article-share__button:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.yt-community-post__share-icon {
  width: 18px;
  height: 18px;
  display: block;
  background-color: currentColor;
  mask-image: url(/static/icons/share_icon.svg);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: url(/static/icons/share_icon.svg);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}

.yt-community-post__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.93rem;
}

.yt-community-post__text {
  line-height: 1.48;
  white-space: normal;
  word-break: break-word;
}

.yt-community-post__text br {
  content: "";
}

.yt-community-post__embed {
  margin: 0;
  padding: 0;
}

.yt-community-post__embed img {
  border-radius: 12px;
  width: 100%;
  height: auto;
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.yt-community-post__footer {
  margin-top: 4px;
}

.yt-community-post__actions {
  display: flex;
  gap: 16px;
  color: #b0b0b0;
  font-size: 0.82rem;
  pointer-events: none;
  user-select: none;
}

.yt-community-post__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: 0.9;
}

.yt-community-post__action svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.yt-community-post__count {
  font-size: 0.78rem;
  color: #cecece;
}

@media (hover: none) {
  .yt-community-post__share.article-share__button {
    opacity: 1;
  }
}

@keyframes yt-community-post-target {
  0% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0.55), 0 0 0 rgba(235, 28, 36, 0.12);
  }
  35% {
    box-shadow: 0 0 0 6px rgba(235, 28, 36, 0.3), 0 0 30px rgba(235, 28, 36, 0.45);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0);
  }
}

.yt-community-post:target {
  animation: yt-community-post-target 1.6s ease-out;
  box-shadow: 0 0 0 2px rgba(235, 28, 36, 0.45), 0 0 28px rgba(235, 28, 36, 0.32);
}

.yt-community-post:target .yt-community-post__share.article-share__button {
  opacity: 1;
}
`

export const YouTubeCommunityPosts: QuartzTransformerPlugin = () => {
  return {
    name: "YouTubeCommunityPosts",
    markdownPlugins() {
      return [
        () => async (tree: unknown, file: { data?: { slug?: FullSlug } }) => {
          const slug = typeof file?.data?.slug === "string" ? (file.data.slug as FullSlug) : undefined
          if (!slug) {
            return
          }

          const slugLower = slug.toLowerCase()
          const isCanonicalPage = slugLower === TARGET_SLUG

          const root = tree as MdParent
          if (!Array.isArray(root.children)) {
            return
          }

          let currentYear: string | undefined

          for (let idx = 0; idx < root.children.length; idx++) {
            const child = root.children[idx]
            if (!child || typeof child !== "object") {
              continue
            }

            if (isCanonicalPage && child.type === "heading" && Array.isArray(child.children)) {
              const text = collectText(child).toLowerCase()
              const match = text.match(/from\s+(\d{4})/)
              currentYear = match ? match[1] : currentYear
              continue
            }

            if (child.type !== "code") {
              continue
            }

            const langRaw = typeof child.lang === "string" ? child.lang.trim() : ""
            const metaRaw = typeof child.meta === "string" ? child.meta.trim() : ""
            const headerRaw = [langRaw, metaRaw].filter((segment) => segment.length > 0).join(",")
            const headerResult = parseCommunityPostHeader(headerRaw)

            if (!headerResult) {
              continue
            }

            const channelHandle = headerResult.metadata.channelHandle || DEFAULT_CHANNEL_HANDLE
            const channelProfile = await getChannelProfile(channelHandle)

            let value = typeof child.value === "string" ? child.value : ""
            if (headerResult.inlineBody) {
              value = value.length > 0 ? `${headerResult.inlineBody}\n${value}` : headerResult.inlineBody
            }
            
            const html = renderPost({
              content: value,
              year: currentYear,
              slug,
              metadataHint: headerResult.metadata,
              channelProfile,
            })

            if (!html) {
              continue
            }

            root.children.splice(idx, 1, {
              type: "html",
              value: html,
            })
          }
        },
      ]
    },
    externalResources() {
      return {
        css: [
          {
            content: YT_COMMUNITY_CSS,
            inline: true,
          },
        ],
      }
    },
  }
}

export default YouTubeCommunityPosts
