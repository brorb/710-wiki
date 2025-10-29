import path from "node:path"
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
const CHANNEL_NAME = "7/10 Tone"
const AVATAR_TARGET = "Media/710 Media/Images/710 tone pfp small.jpg"

const CONTENT_ROOT = path.resolve(process.cwd(), "../Content")
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
}

const EMBED_REGEX = /!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g

const METADATA_LINE_REGEX = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*([^,\n]+?)(?:\s*,\s*)?(?:\r?\n|$)/i
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

  const parts = trimmed.split(",").map((part) => part.trim())
  if (parts.length < 4) {
    return null
  }

  const likes = Number.parseInt(parts[1] ?? "", 10)
  const comments = Number.parseInt(parts[2] ?? "", 10)
  if (!Number.isFinite(likes) || !Number.isFinite(comments)) {
    return null
  }

  const postedLabelRaw = parts[3] ?? ""
  const inlineSegments = parts.slice(4)
  while (inlineSegments.length > 0 && inlineSegments[inlineSegments.length - 1].length === 0) {
    inlineSegments.pop()
  }

  const inlineBody = inlineSegments.join(",").trim()
  const metadata: PostMetadata = {}
  metadata.likes = likes
  metadata.comments = comments

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

  const [, likesRaw, commentsRaw, labelRaw] = match
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
  const content = normaliseWhitespace(segment.content)
  if (!content.trim()) {
    return ""
  }

  const safe = escapeHtml(content).replace(/\n/g, "<br />")
  return `<div class="yt-community-post__text">${safe}</div>`
}

const renderEmbedSegment = (segment: EmbedSegment, slug: FullSlug): string => {
  if (!segment.target) {
    return ""
  }

  const src = resolveObsidianTarget(segment.target, slug)
  const width = parseNumericAlias(segment.alias)
  const fallbackAlt = toSentenceCase(segment.target.split("/").pop() ?? "") || CHANNEL_NAME
  const aliasAlt = width ? undefined : segment.alias
  const alt = escapeAttribute((aliasAlt && aliasAlt.length > 0 ? aliasAlt : fallbackAlt) || CHANNEL_NAME)
  const styles: string[] = []
  if (width) {
    styles.push(`max-width: ${width}px`)
  }

  const styleAttr = styles.length > 0 ? ` style="${escapeAttribute(styles.join("; "))}"` : ""

  return `<figure class="yt-community-post__embed">
    <img src="${escapeAttribute(src)}" alt="${alt}" loading="lazy" decoding="async"${styleAttr} />
  </figure>`
}

const renderSegments = (segments: Segment[], slug: FullSlug): string => {
  return segments
    .map((segment) => {
      if (segment.type === "text") {
        return renderTextSegment(segment)
      }
      return renderEmbedSegment(segment, slug)
    })
    .filter((html) => html.length > 0)
    .join("\n")
}

const renderPost = (options: {
  content: string
  year?: string
  slug: FullSlug
  avatarSrc: string
  metadataHint?: PostMetadata
}): string => {
  const { content, year, slug, avatarSrc, metadataHint } = options
  const trimmed = content.replace(/^\s+|\s+$/g, "")
  if (!trimmed) {
    return ""
  }

  const { metadata: bodyMetadata, body } = parseBodyMetadata(trimmed)
  const metadata: PostMetadata = {
    ...metadataHint,
    ...bodyMetadata,
  }
  const cleanedBody = body.replace(/^\s+/, "")
  const segments = splitSegments(cleanedBody)
  const bodyHtml = renderSegments(segments, slug)
  const timestamp = metadata.postedLabel
    ? `Posted ${escapeHtml(metadata.postedLabel)}`
    : year
      ? `Posted ${escapeHtml(year)}`
      : "Posted"

  const likeCount = formatCount(metadata.likes)
  const commentCount = formatCount(metadata.comments)
  const dataPosted = metadata.postedLabel ?? year ?? ""

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
    `data-share-title="${escapeAttribute(`${CHANNEL_NAME} community post`)}"`,
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
    <img src="${escapeAttribute(avatarSrc)}" alt="${escapeAttribute(CHANNEL_NAME)}" loading="lazy" width="48" height="48" />
  </span>
  <div class="yt-community-post__content">
    <div class="yt-community-post__header">
      <div class="yt-community-post__identity">
        <span class="yt-community-post__channel">${escapeHtml(CHANNEL_NAME)}</span>
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

.yt-community-post__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: #121212;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 2px;
  flex-shrink: 0;
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
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.yt-community-post__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.yt-community-post__identity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  line-height: 1;
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
  align-items: flex-end;
  gap: 2px;
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
        () => (tree: unknown, file: { data?: { slug?: FullSlug } }) => {
          const slug = typeof file?.data?.slug === "string" ? (file.data.slug as FullSlug) : undefined
          if (!slug || slug.toLowerCase() !== TARGET_SLUG) {
            return
          }

          const root = tree as MdParent
          if (!Array.isArray(root.children)) {
            return
          }

          const avatarSrc = resolveObsidianTarget(AVATAR_TARGET, slug)
          let currentYear: string | undefined

          for (let idx = 0; idx < root.children.length; idx++) {
            const child = root.children[idx]
            if (!child || typeof child !== "object") {
              continue
            }

            if (child.type === "heading" && Array.isArray(child.children)) {
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
            const headerResult = parseCommunityPostHeader(langRaw) ?? parseCommunityPostHeader(metaRaw)

            if (!headerResult) {
              continue
            }

            let value = typeof child.value === "string" ? child.value : ""
            if (headerResult.inlineBody) {
              value = value.length > 0 ? `${headerResult.inlineBody}\n${value}` : headerResult.inlineBody
            }
            const html = renderPost({
              content: value,
              year: currentYear,
              slug,
              avatarSrc,
              metadataHint: headerResult.metadata,
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
