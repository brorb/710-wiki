import { Code } from "mdast"
import { QuartzTransformerPlugin } from "../types"
import { FilePath, FullSlug, joinSegments, pathToRoot, slugifyFilePath } from "../../util/path"
import { findAssetByBasename } from "../../util/assetLookup"
import { getAssetVersion } from "../../util/assetVersion"

type MediaType = "image" | "video" | "audio"

type RawMediaBox = {
  title?: string
  src?: string
  alt?: string
  caption?: string
  credit?: string
  align?: string
  wrap?: string
  width?: string
  link?: string
  type?: string
  poster?: string
  autoplay?: string
  loop?: string
  muted?: string
}

type ParsedMediaBox = {
  title?: string
  src: string
  alt?: string
  caption?: string
  credit?: string
  align: "left" | "center" | "right"
  wrap: boolean
  width?: string
  link?: string
  mediaType: MediaType
  poster?: string
  autoplay: boolean
  loop: boolean
  muted: boolean
}

const OBSIDIAN_EMBED_PATTERN = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/
const MEDIA_LANG_ALIASES = new Set(["media-box", "image-box"])

const keyMap: Record<string, keyof RawMediaBox> = {
  title: "title",
  heading: "title",
  label: "title",
  media: "src",
  source: "src",
  image: "src",
  src: "src",
  file: "src",
  path: "src",
  alt: "alt",
  description: "caption",
  caption: "caption",
  credit: "credit",
  photographer: "credit",
  author: "credit",
  align: "align",
  alignment: "align",
  position: "align",
  wrap: "wrap",
  float: "wrap",
  width: "width",
  size: "width",
  link: "link",
  href: "link",
  type: "type",
  kind: "type",
  media_type: "type",
  poster: "poster",
  thumbnail: "poster",
  cover: "poster",
  autoplay: "autoplay",
  loop: "loop",
  muted: "muted",
}

const isExternalUrl = (value: string): boolean => /^(https?:)?\/\//i.test(value) || value.startsWith("data:")

const stripContentPrefix = (target: string): string =>
  target.replace(/^[./]+/, "").replace(/^content\//i, "")

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const escapeAttribute = (value: string): string => escapeHtml(value)

const sanitizeMultiline = (lines: string[]): string =>
  lines
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()

const appendAssetVersion = (url: string, version: string): string => {
  if (!version) {
    return url
  }

  return url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`
}

const resolveObsidianTarget = (rawTarget: string, slug?: FullSlug): string | undefined => {
  const cleaned = rawTarget.trim()
  if (!cleaned) {
    return undefined
  }

  if (isExternalUrl(cleaned)) {
    return cleaned
  }

  try {
    let targetPath = stripContentPrefix(cleaned)
    if (!targetPath.includes("/")) {
      const matched = findAssetByBasename(targetPath)
      if (matched) {
        targetPath = matched
      }
    }

    const targetSlug = slugifyFilePath(targetPath as FilePath)

    if (!slug) {
      return appendAssetVersion(targetSlug, getAssetVersion())
    }

    const baseDir = pathToRoot(slug)
    return appendAssetVersion(joinSegments(baseDir, targetSlug), getAssetVersion())
  } catch {
    return cleaned
  }
}

const resolveMediaSource = (raw: string, slug?: FullSlug): string | undefined => {
  const cleaned = raw.trim()
  if (!cleaned) {
    return undefined
  }

  const match = cleaned.match(OBSIDIAN_EMBED_PATTERN)
  if (match?.groups?.target) {
    return resolveObsidianTarget(match.groups.target, slug)
  }

  if (isExternalUrl(cleaned)) {
    return cleaned
  }

  if (cleaned.startsWith("/")) {
    return appendAssetVersion(cleaned, getAssetVersion())
  }

  if (!slug) {
    return cleaned
  }

  let targetPath = stripContentPrefix(cleaned)
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath)
    if (matched) {
      targetPath = matched
    }
  }

  const targetSlug = slugifyFilePath(targetPath as FilePath)
  return appendAssetVersion(joinSegments(pathToRoot(slug), targetSlug), getAssetVersion())
}

const resolveLinkTarget = (raw: string, slug?: FullSlug): string | undefined => {
  const cleaned = raw.trim()
  if (!cleaned) {
    return undefined
  }

  const match = cleaned.match(OBSIDIAN_EMBED_PATTERN)
  if (match?.groups?.target) {
    return resolveObsidianTarget(match.groups.target, slug) ?? cleaned
  }

  if (isExternalUrl(cleaned) || cleaned.startsWith("/")) {
    return cleaned
  }

  if (!slug) {
    return cleaned
  }

  let targetPath = stripContentPrefix(cleaned)
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath)
    if (matched) {
      targetPath = matched
    }
  }

  const targetSlug = slugifyFilePath(targetPath as FilePath)
  return joinSegments(pathToRoot(slug), targetSlug)
}

const sanitizeCssValue = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  if (!/^[0-9a-zA-Z%.,()\s_-]+$/.test(trimmed)) {
    return undefined
  }

  return trimmed
}

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) {
    return defaultValue
  }

  const normalised = value.trim().toLowerCase()
  if (["true", "yes", "y", "1", "wrap", "on"].includes(normalised)) {
    return true
  }
  if (["false", "no", "n", "0", "none", "off"].includes(normalised)) {
    return false
  }
  return defaultValue
}

const normaliseAlign = (value: string | undefined): "left" | "center" | "right" => {
  if (!value) {
    return "center"
  }

  const trimmed = value.trim().toLowerCase()
  if (trimmed === "left" || trimmed === "start") {
    return "left"
  }
  if (trimmed === "right" || trimmed === "end") {
    return "right"
  }
  if (trimmed === "centre") {
    return "center"
  }
  return "center"
}

const inferMediaType = (rawType: string | undefined, src: string): MediaType => {
  if (rawType) {
    const normalised = rawType.trim().toLowerCase()
    if (normalised === "video" || normalised === "audio" || normalised === "image") {
      return normalised
    }
  }

  if (src.startsWith("data:") && src.includes("video")) {
    return "video"
  }
  if (src.startsWith("data:") && src.includes("audio")) {
    return "audio"
  }

  const withoutQuery = src.split("?")[0]?.split("#")[0]?.toLowerCase() ?? ""

  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(withoutQuery)) {
    return "video"
  }

  if (/\.(mp3|ogg|wav|m4a|flac|aac)$/.test(withoutQuery)) {
    return "audio"
  }

  return "image"
}

const parseMediaBoxBlock = (raw: string): RawMediaBox | null => {
  const result: RawMediaBox = {}
  const lines = raw.split(/\r?\n/)
  let currentKey: keyof RawMediaBox | null = null
  let buffer: string[] = []

  const flushBuffer = () => {
    if (!currentKey) {
      buffer = []
      return
    }

    const combined = sanitizeMultiline(buffer)
    if (combined.length > 0) {
      result[currentKey] = combined
    }
    buffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushBuffer()
      currentKey = null
      continue
    }

    if (trimmed.startsWith("#")) {
      continue
    }

    const indent = line.length - line.trimStart().length
    if (indent > 0 && currentKey) {
      buffer.push(trimmed)
      continue
    }

    const colonIndex = trimmed.indexOf(":")
    if (colonIndex === -1) {
      flushBuffer()
      currentKey = null
      continue
    }

    flushBuffer()

    const keyRaw = trimmed.slice(0, colonIndex).trim().toLowerCase()

    if (keyRaw === "video" || keyRaw === "audio") {
      const value = trimmed.slice(colonIndex + 1).trim()
      if (value.length > 0) {
        result.src = value
      }
      result.type = keyRaw
      currentKey = "src"
      buffer = value ? [value] : []
      continue
    }

    const mapped = keyMap[keyRaw]
    if (!mapped) {
      currentKey = null
      continue
    }

    const value = trimmed.slice(colonIndex + 1).trim()
    result[mapped] = value
    currentKey = mapped
    buffer = value ? [value] : []
  }

  flushBuffer()

  if (!result.src || !result.src.trim()) {
    return null
  }

  return result
}

const buildMediaMarkup = (config: ParsedMediaBox): string => {
  const buildSourceTag = (src: string, mediaType: MediaType): string => {
    const escapedSrc = escapeAttribute(src)
    const withoutQuery = src.split("?")[0]?.split("#")[0]?.toLowerCase() ?? ""

    const lookup: Record<MediaType, Record<string, string>> = {
      image: {},
      video: {
        ".mp4": "video/mp4",
        ".m4v": "video/x-m4v",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".ogv": "video/ogg",
      },
      audio: {
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".oga": "audio/ogg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
      },
    }

    let typeAttr = ""
    for (const [extension, mime] of Object.entries(lookup[mediaType])) {
      if (withoutQuery.endsWith(extension)) {
        typeAttr = ` type="${mime}"`
        break
      }
    }

    return `<source src="${escapedSrc}"${typeAttr} />`
  }

  if (config.mediaType === "image") {
    const imageTag = `<img src="${escapeAttribute(config.src)}" alt="${escapeAttribute(
      config.alt || "Media illustration",
    )}" loading="lazy" decoding="async" />`

    if (config.link) {
      return `<a class="media-box__link" href="${escapeAttribute(config.link)}"${
        isExternalUrl(config.link) ? ' target="_blank" rel="noopener"' : ""
      }>${imageTag}</a>`
    }

    return imageTag
  }

  if (config.mediaType === "video") {
    const attrs = [
      `src="${escapeAttribute(config.src)}"`,
      "controls",
      "playsinline",
      "preload=\"metadata\"",
      `aria-label="${escapeAttribute(config.alt || config.title || "Embedded video")}"`,
    ]

    if (config.poster) {
      attrs.push(`poster="${escapeAttribute(config.poster)}"`)
    }

    if (config.autoplay) {
      attrs.push("autoplay")
    }

    if (config.muted || config.autoplay) {
      attrs.push("muted")
    }

    if (config.loop) {
      attrs.push("loop")
    }

    const fallback = escapeHtml(config.alt || config.title || "Your browser cannot play this video.")
    return `<video ${attrs.join(" ")}>${buildSourceTag(config.src, "video")}${fallback}</video>`
  }

  const audioAttrs = [
    `src="${escapeAttribute(config.src)}"`,
    "controls",
    "preload=\"metadata\"",
    `aria-label="${escapeAttribute(config.alt || config.title || "Embedded audio")}"`,
  ]

  if (config.autoplay) {
    audioAttrs.push("autoplay")
  }

  if (config.loop) {
    audioAttrs.push("loop")
  }

  if (config.muted) {
    audioAttrs.push("muted")
  }

  const fallback = escapeHtml(config.alt || config.title || "Your browser cannot play this audio clip.")
  return `<audio ${audioAttrs.join(" ")}>${buildSourceTag(config.src, "audio")}${fallback}</audio>`
}

const buildMediaBoxHtml = (config: ParsedMediaBox): string => {
  const classes = [
    "media-box",
    `media-box--align-${config.align}`,
    `media-box--type-${config.mediaType}`,
  ]

  if (config.wrap) {
    classes.push("media-box--wrap")
  } else {
    classes.push("media-box--no-wrap")
  }

  const styleParts: string[] = []
  if (config.width) {
    styleParts.push(`max-width: ${config.width}`)
  }

  const styleAttr = styleParts.length > 0 ? ` style="${escapeAttribute(styleParts.join("; "))}"` : ""

  const titleMarkup = config.title
    ? `<header class="media-box__title">${escapeHtml(config.title)}</header>`
    : ""

  const mediaMarkup = buildMediaMarkup(config)

  const captionParts: string[] = []
  if (config.caption) {
    const captionHtml = escapeHtml(config.caption).replace(/\r?\n/g, "<br />")
    captionParts.push(`<span class="media-box__caption-text">${captionHtml}</span>`)
  }
  if (config.credit) {
    const creditHtml = escapeHtml(config.credit).replace(/\r?\n/g, "<br />")
    captionParts.push(`<span class="media-box__credit">${creditHtml}</span>`)
  }

  const captionMarkup = captionParts.length > 0
    ? `<figcaption class="media-box__caption">${captionParts.join("")}</figcaption>`
    : ""

  return `<figure class="${classes.join(" ")}"${styleAttr}>${titleMarkup}<div class="media-box__media">${mediaMarkup}</div>${captionMarkup}</figure>`
}

const MEDIA_BOX_CSS = `
.media-box {
  --media-box-background: color-mix(in srgb, var(--color-surface-overlay) 92%, transparent);
  background: var(--media-box-background);
  border: 1px solid color-mix(in srgb, var(--color-tone-muted) 35%, transparent);
  border-radius: 14px;
  padding: 0.9rem 0.95rem 1.05rem;
  display: grid;
  gap: 0.65rem;
  box-shadow: 0 1.15rem 2.1rem rgba(0, 0, 0, 0.14);
  margin: 1.75rem auto;
  max-width: min(100%, 420px);
  color: var(--color-tone-contrast);
}

.media-box__title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: center;
  margin: 0;
  color: var(--color-tone-primary);
}

.media-box__media {
  display: block;
}

.media-box__media img,
.media-box__media video,
.media-box__media audio {
  width: 100%;
  height: auto;
  border-radius: 10px;
  box-shadow: 0 0.75rem 1.45rem rgba(0, 0, 0, 0.18);
  display: block;
}

.media-box__media audio {
  box-shadow: none;
  border-radius: 8px;
}

.media-box__link {
  display: block;
}

.media-box__caption {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--color-tone-muted) 78%, var(--color-tone-contrast) 22%);
}

.media-box__caption-text {
  display: block;
}

.media-box__credit {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 85%, var(--color-tone-primary) 15%);
}

.media-box--align-left.media-box--wrap {
  float: left;
  margin: 0 1.5rem 1.25rem 0;
}

.media-box--align-right.media-box--wrap {
  float: right;
  margin: 0 0 1.25rem 1.5rem;
}

.media-box--align-center {
  margin-left: auto;
  margin-right: auto;
}

.media-box--align-left.media-box--no-wrap {
  margin-left: 0;
  margin-right: auto;
}

.media-box--align-right.media-box--no-wrap {
  margin-left: auto;
  margin-right: 0;
}

.media-box--wrap {
  max-width: min(100%, 340px);
}

.media-box--type-audio .media-box__media {
  padding-inline: clamp(0.4rem, 2vw, 1rem);
}

.media-box-cluster {
  margin: 1.75rem auto;
}

.media-box-cluster--inline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  align-items: start;
}

.media-box-cluster--inline .media-box {
  margin: 0;
  float: none;
}

.media-box-cluster--inline .media-box--align-left {
  justify-self: start;
}

.media-box-cluster--inline .media-box--align-center {
  justify-self: center;
}

.media-box-cluster--inline .media-box--align-right {
  justify-self: end;
}

@media (min-width: 901px) {
  .media-box-cluster--inline.media-box-cluster--three {
    grid-template-columns: repeat(3, minmax(220px, 1fr));
  }
}

@media (max-width: 900px) {
  .media-box--wrap {
    float: none !important;
    margin: 1.5rem auto !important;
  }

  .media-box-cluster--inline {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .media-box-cluster--inline .media-box {
    justify-self: center;
    max-width: min(100%, 420px);
  }
}
`

type MdNode = {
  type?: string
  children?: MdNode[]
  [key: string]: unknown
}

type HtmlNode = {
  type: "html"
  value: string
}

const isMediaBoxCodeNode = (node: unknown): node is Code => {
  if (!node || typeof node !== "object") {
    return false
  }

  const maybe = node as Code
  if (maybe.type !== "code") {
    return false
  }

  const lang = typeof maybe.lang === "string" ? maybe.lang.toLowerCase() : ""
  return MEDIA_LANG_ALIASES.has(lang)
}

const createHtmlNode = (value: string): HtmlNode => ({
  type: "html",
  value,
})

const toMediaBoxConfig = (node: Code, slug?: FullSlug): ParsedMediaBox | null => {
  const raw = typeof node.value === "string" ? node.value : ""
  const parsed = parseMediaBoxBlock(raw)
  if (!parsed) {
    return null
  }

  const srcResolved = resolveMediaSource(parsed.src ?? "", slug)
  if (!srcResolved) {
    return null
  }

  const posterResolved = parsed.poster ? resolveMediaSource(parsed.poster, slug) : undefined
  const mediaType = inferMediaType(parsed.type, srcResolved)

  const align = normaliseAlign(parsed.align)
  const wrap = parseBoolean(parsed.wrap, align !== "center")
  const width = sanitizeCssValue(parsed.width)

  const linkRaw = parsed.link ? parsed.link.trim() : undefined
  const linkResolved = linkRaw ? resolveLinkTarget(linkRaw, slug) : undefined

  return {
    title: parsed.title?.trim() || undefined,
    src: srcResolved,
    alt: parsed.alt?.trim() || undefined,
    caption: parsed.caption?.trim() || undefined,
    credit: parsed.credit?.trim() || undefined,
    align,
    wrap,
    width,
    link: mediaType === "image" && linkResolved && linkResolved.length > 0 ? linkResolved : undefined,
    mediaType,
    poster: posterResolved,
    autoplay: parseBoolean(parsed.autoplay, false),
    loop: parseBoolean(parsed.loop, false),
    muted: parseBoolean(parsed.muted, false),
  }
}

const transformMediaBoxes = (tree: unknown, slug?: FullSlug) => {
  const process = (node: MdNode | undefined) => {
    if (!node || typeof node !== "object" || !Array.isArray(node.children)) {
      return
    }

    const children = node.children

    for (let index = 0; index < children.length; ) {
      const child = children[index]

      if (!isMediaBoxCodeNode(child)) {
        process(child as MdNode)
        index += 1
        continue
      }

      const group: Code[] = []
      let cursor = index
      while (cursor < children.length) {
        const candidate = children[cursor]
        if (!isMediaBoxCodeNode(candidate)) {
          break
        }
        group.push(candidate as Code)
        cursor += 1
      }

      const configs = group.map((code) => toMediaBoxConfig(code, slug))
      const validEntries = configs.filter((config): config is ParsedMediaBox => config !== null)

      if (validEntries.length === 0) {
        children.splice(index, group.length)
        continue
      }

      const htmlFigures = validEntries.map((config) => buildMediaBoxHtml(config))
      const allNoWrap = validEntries.every((config) => !config.wrap)

      let replacements: HtmlNode[]
      if (validEntries.length > 1 && allNoWrap) {
        const alignSignature = validEntries.map((config) => config.align).join("|")
        let clusterClass = "media-box-cluster media-box-cluster--inline"
        if (validEntries.length === 3 && alignSignature === "left|center|right") {
          clusterClass += " media-box-cluster--three"
        }

        replacements = [
          createHtmlNode(`<div class="${clusterClass}">${htmlFigures.join("")}</div>`),
        ]
      } else {
        replacements = htmlFigures.map((value) => createHtmlNode(value))
      }

      children.splice(index, group.length, ...replacements)
      index += replacements.length
    }
  }

  process(tree as MdNode)
}

export const MediaBox: QuartzTransformerPlugin = () => {
  return {
    name: "MediaBox",
    markdownPlugins() {
      return [
        () => (tree: unknown, file: { data?: { slug?: FullSlug } }) => {
          const slug = typeof file?.data?.slug === "string" ? (file.data.slug as FullSlug) : undefined
          transformMediaBoxes(tree, slug)
        },
      ]
    },
    externalResources() {
      return {
        css: [
          {
            inline: true,
            content: MEDIA_BOX_CSS,
          },
        ],
      }
    },
  }
}

export default MediaBox
