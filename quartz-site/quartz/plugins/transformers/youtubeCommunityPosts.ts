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

const EMBED_REGEX = /!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g

const splitSegments = (raw: string): Segment[] => {
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
}): string => {
  const { content, year, slug, avatarSrc } = options
  const trimmed = content.replace(/^\s+|\s+$/g, "")
  if (!trimmed) {
    return ""
  }

  const segments = splitSegments(trimmed)
  const bodyHtml = renderSegments(segments, slug)
  const timestamp = year ? `Posted ${escapeHtml(year)}` : "Posted"

  const bodySection = bodyHtml.trim().length
    ? `<div class="yt-community-post__body">
      ${bodyHtml}
    </div>`
    : ""

  return `<article class="yt-community-post" data-posted="${escapeAttribute(year ?? "")}">
  <span class="yt-community-post__avatar">
    <img src="${escapeAttribute(avatarSrc)}" alt="${escapeAttribute(CHANNEL_NAME)}" loading="lazy" width="48" height="48" />
  </span>
  <div class="yt-community-post__content">
    <header class="yt-community-post__header">
      <span class="yt-community-post__channel">${escapeHtml(CHANNEL_NAME)}</span>
      <span class="yt-community-post__timestamp">${timestamp}</span>
    </header>
    ${bodySection}
    <footer class="yt-community-post__footer">
      <div class="yt-community-post__actions" aria-hidden="true">
        <span class="yt-community-post__action">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14 1 7.59 7.41C7.22 7.78 7 8.3 7 8.83V19c0 1.1.9 2 2 2h8c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
          <span>Like</span>
        </span>
        <span class="yt-community-post__action">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12l5 4V5c0-1.1-.9-2-2-2h-3z" /></svg>
          <span>Comment</span>
        </span>
        <span class="yt-community-post__action">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.53.5 1.23.81 2.04.81 1.66 0 3-1.34 3-3S19.66 2 18 2s-3 1.34-3 3c0 .24.04.47.09.7L7.91 9.81C7.38 9.31 6.68 9 5.87 9 4.21 9 2.87 10.34 2.87 12s1.34 3 3 3c.81 0 1.51-.31 2.04-.81l7.12 4.16c-.05.2-.08.41-.08.63 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z" /></svg>
          <span>Share</span>
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
  padding: 16px 18px;
  color: #f1f1f1;
  max-width: min(640px, 100%);
  font-family: "Roboto", "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  display: grid;
  grid-template-columns: 48px 1fr;
  column-gap: 14px;
  row-gap: 12px;
  align-items: flex-start;
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
  gap: 8px;
}

.yt-community-post__header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1.2;
}

.yt-community-post__channel {
  font-weight: 600;
  font-size: 0.95rem;
}

.yt-community-post__timestamp {
  color: #a7a7a7;
  font-size: 0.78rem;
}

.yt-community-post__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

            const lang = typeof child.lang === "string" ? child.lang.trim().toLowerCase() : ""
            if (lang && lang !== "text") {
              continue
            }

            const value = typeof child.value === "string" ? child.value : ""
            const html = renderPost({
              content: value,
              year: currentYear,
              slug,
              avatarSrc,
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
