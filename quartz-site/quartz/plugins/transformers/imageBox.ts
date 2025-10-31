import { Code } from "mdast"
import { QuartzTransformerPlugin } from "../types"
import { SKIP, visit } from "unist-util-visit"
import { FilePath, FullSlug, joinSegments, pathToRoot, slugifyFilePath } from "../../util/path"
import { getAssetVersion } from "../../util/assetVersion"

const OBSIDIAN_EMBED_PATTERN = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/
const isExternalUrl = (value: string) => /^(https?:)?\/\//i.test(value) || value.startsWith("data:")

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

  if (!slug) {
    return cleaned
  }

  try {
    const target = stripContentPrefix(cleaned) as FilePath
    const targetSlug = slugifyFilePath(target)
    const baseDir = pathToRoot(slug)
    return appendAssetVersion(joinSegments(baseDir, targetSlug), getAssetVersion())
  } catch {
    return cleaned
  }
}

const resolveImageSource = (raw: string, slug?: FullSlug): string | undefined => {
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

  const target = stripContentPrefix(cleaned)
  return appendAssetVersion(joinSegments(pathToRoot(slug), target), getAssetVersion())
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

  const target = stripContentPrefix(cleaned)
  return joinSegments(pathToRoot(slug), target)
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

type RawImageBox = {
  title?: string
  src?: string
  alt?: string
  caption?: string
  credit?: string
  align?: string
  wrap?: string
  width?: string
  link?: string
}

type ParsedImageBox = {
  title?: string
  src: string
  alt?: string
  caption?: string
  credit?: string
  align: "left" | "center" | "right"
  wrap: boolean
  width?: string
  link?: string
}

const keyMap: Record<string, keyof RawImageBox> = {
  title: "title",
  heading: "title",
  label: "title",
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

const parseImageBoxBlock = (raw: string): RawImageBox | null => {
  const result: RawImageBox = {}
  const lines = raw.split(/\r?\n/)
  let currentKey: keyof RawImageBox | null = null
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

const buildImageBoxHtml = (config: ParsedImageBox): string => {
  const classes = ["image-box", `image-box--align-${config.align}`]
  if (config.wrap) {
    classes.push("image-box--wrap")
  } else {
    classes.push("image-box--no-wrap")
  }

  const styleParts: string[] = []
  if (config.width) {
    styleParts.push(`max-width: ${config.width}`)
  }

  const styleAttr = styleParts.length > 0 ? ` style="${escapeAttribute(styleParts.join("; "))}"` : ""

  const titleMarkup = config.title
    ? `<header class="image-box__title">${escapeHtml(config.title)}</header>`
    : ""

  const imageTag = `<img src="${escapeAttribute(config.src)}" alt="${escapeAttribute(
    config.alt || "Image illustration",
  )}" loading="lazy" decoding="async" />`

  const mediaMarkup = config.link
    ? `<a class="image-box__link" href="${escapeAttribute(config.link)}"${
        isExternalUrl(config.link) ? ' target="_blank" rel="noopener"' : ""
      }>${imageTag}</a>`
    : imageTag

  const captionParts: string[] = []
  if (config.caption) {
    const captionHtml = escapeHtml(config.caption).replace(/\r?\n/g, "<br />")
    captionParts.push(`<span class="image-box__caption-text">${captionHtml}</span>`)
  }
  if (config.credit) {
    const creditHtml = escapeHtml(config.credit).replace(/\r?\n/g, "<br />")
    captionParts.push(`<span class="image-box__credit">${creditHtml}</span>`)
  }

  const captionMarkup = captionParts.length > 0
    ? `<figcaption class="image-box__caption">${captionParts.join("")}</figcaption>`
    : ""

  return `<figure class="${classes.join(" ")}"${styleAttr}>${titleMarkup}<div class="image-box__media">${mediaMarkup}</div>${captionMarkup}</figure>`
}

const IMAGE_BOX_CSS = `
.image-box {
  --image-box-background: color-mix(in srgb, var(--color-surface-overlay) 92%, transparent);
  background: var(--image-box-background);
  border: 1px solid color-mix(in srgb, var(--color-tone-muted) 35%, transparent);
  border-radius: 14px;
  padding: 0.9rem 0.95rem 1.05rem;
  display: grid;
  gap: 0.65rem;
  box-shadow: 0 1.15rem 2.1rem rgba(0, 0, 0, 0.14);
  margin: 1.75rem auto;
  max-width: min(100%, 380px);
  color: var(--color-tone-contrast);
}

.image-box__title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: center;
  margin: 0;
  color: var(--color-tone-primary);
}

.image-box__media {
  display: block;
}

.image-box__media img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  box-shadow: 0 0.75rem 1.45rem rgba(0, 0, 0, 0.18);
  display: block;
}

.image-box__link {
  display: block;
}

.image-box__caption {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--color-tone-muted) 78%, var(--color-tone-contrast) 22%);
}

.image-box__caption-text {
  display: block;
}

.image-box__credit {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 85%, var(--color-tone-primary) 15%);
}

.image-box--align-left.image-box--wrap {
  float: left;
  margin: 0 1.5rem 1.25rem 0;
}

.image-box--align-right.image-box--wrap {
  float: right;
  margin: 0 0 1.25rem 1.5rem;
}

.image-box--align-center {
  margin-left: auto;
  margin-right: auto;
}

.image-box--align-left.image-box--no-wrap {
  margin-left: 0;
  margin-right: auto;
}

.image-box--align-right.image-box--no-wrap {
  margin-left: auto;
  margin-right: 0;
}

.image-box--wrap {
  max-width: min(100%, 320px);
}

@media (max-width: 900px) {
  .image-box--wrap {
    float: none !important;
    margin: 1.5rem auto !important;
  }
}
`

const transformImageBoxes = (tree: unknown, slug?: FullSlug) => {
  visit(tree as unknown as import("unist").Node, "code", (node: Code, index, parent) => {
    const lang = typeof node.lang === "string" ? node.lang.toLowerCase() : ""
    if (lang !== "image-box") {
      return
    }

    const raw = typeof node.value === "string" ? node.value : ""
    const parsed = parseImageBoxBlock(raw)
    if (!parsed) {
      if (parent && typeof index === "number") {
        ;(parent as unknown as { children: unknown[] }).children.splice(index, 1)
        return [SKIP, index]
      }
      return
    }

    const srcResolved = resolveImageSource(parsed.src ?? "", slug)
    if (!srcResolved) {
      if (parent && typeof index === "number") {
        ;(parent as unknown as { children: unknown[] }).children.splice(index, 1)
        return [SKIP, index]
      }
      return
    }

    const align = normaliseAlign(parsed.align)
    const wrap = parseBoolean(parsed.wrap, align !== "center")
    const width = sanitizeCssValue(parsed.width)
    const linkRaw = parsed.link ? parsed.link.trim() : undefined
    const linkResolved = linkRaw ? resolveLinkTarget(linkRaw, slug) : undefined

    const config: ParsedImageBox = {
      title: parsed.title?.trim() || undefined,
      src: srcResolved,
      alt: parsed.alt?.trim() || undefined,
      caption: parsed.caption?.trim() || undefined,
      credit: parsed.credit?.trim() || undefined,
      align,
      wrap,
      width,
      link: linkResolved && linkResolved.length > 0 ? linkResolved : undefined,
    }

    const html = buildImageBoxHtml(config)

    if (parent && typeof index === "number") {
      ;(parent as unknown as { children: unknown[] }).children.splice(index, 1, {
        type: "html",
        value: html,
      })
      return [SKIP, index]
    }

    return
  })
}

export const ImageBox: QuartzTransformerPlugin = () => {
  return {
    name: "ImageBox",
    markdownPlugins() {
      return [
        () => (tree: unknown, file: { data?: { slug?: FullSlug } }) => {
          const slug = typeof file?.data?.slug === "string" ? (file.data.slug as FullSlug) : undefined
          transformImageBoxes(tree, slug)
        },
      ]
    },
    externalResources() {
      return {
        css: [
          {
            inline: true,
            content: IMAGE_BOX_CSS,
          },
        ],
      }
    },
  }
}

export default ImageBox
