import { ComponentChildren, Fragment } from "preact"
import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import {
  FilePath,
  FullSlug,
  joinSegments,
  pathToRoot,
  slugifyFilePath,
  transformLink,
} from "../util/path"
import { getAssetVersion } from "../util/assetVersion"

interface FrontmatterInfoBoxItem {
  label?: unknown
  value?: unknown
}

interface FrontmatterInfoBoxImage {
  src?: unknown
  alt?: unknown
  caption?: unknown
}

interface FrontmatterInfoBox {
  title?: unknown
  image?: FrontmatterInfoBoxImage
  items?: unknown
}

type NormalizedInfoBoxItem = {
  label: string
  value: preact.ComponentChildren
  key: string
}

type NormalizedInfoBox = {
  title?: string
  image?: {
    src: string
    alt?: string
    caption?: string
  }
  items: NormalizedInfoBoxItem[]
}

const isExternalUrl = (url: string) => /^(https?:)?\/\//i.test(url)

const OBSIDIAN_EMBED_PATTERN = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/
const OBSIDIAN_WIKILINK_PATTERN = /\[\[([^|\]#]+)?(#[^|\]]+)?(?:\|([^\]]+))?\]\]/g

const stripContentPrefix = (target: string): string =>
  target.replace(/^[./]+/, "").replace(/^content\//i, "")

const normalizeString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return undefined
}

const intersperse = (values: ComponentChildren[], separator: string): ComponentChildren[] =>
  values.flatMap((node, index) => (index === 0 ? [node] : [separator, node]))

const findSlugMatch = (target: string, ctx: QuartzComponentProps["ctx"]): FullSlug | undefined => {
  const sanitized = stripContentPrefix(target)
  const withExt = sanitized.endsWith(".md") ? sanitized : `${sanitized}.md`

  try {
    const candidate = slugifyFilePath(withExt as FilePath, true)
    if (ctx.allSlugs.includes(candidate)) {
      return candidate
    }

    return ctx.allSlugs.find((slug) => slug.endsWith(`/${candidate}`))
  } catch {
    return undefined
  }
}

const getTitleForSlug = (slug: FullSlug, ctx: QuartzComponentProps["ctx"]): string | undefined => {
  const pathSegments = slug.split("/")
  const node = ctx.trie?.findNode(pathSegments)
  return node?.data?.title ?? node?.displayName ?? pathSegments.at(-1)
}

const renderTextWithWikilinks = (
  raw: string,
  slug: FullSlug,
  ctx: QuartzComponentProps["ctx"],
): ComponentChildren => {
  const nodes: ComponentChildren[] = []
  let lastIndex = 0

  raw.replace(OBSIDIAN_WIKILINK_PATTERN, (match, target = "", anchor = "", alias) => {
    const index = raw.indexOf(match, lastIndex)
    if (index > lastIndex) {
      nodes.push(raw.slice(lastIndex, index))
    }

    const trimmedTarget = target.trim()
    const trimmedAlias = alias?.trim()
    const slugMatch = trimmedTarget ? findSlugMatch(trimmedTarget, ctx) : undefined
    const anchorValue = anchor?.trim() ?? ""

    if (slugMatch) {
      const href = transformLink(slug, `${slugMatch}${anchorValue}`, {
        strategy: "shortest",
        allSlugs: ctx.allSlugs,
      })
      const label = trimmedAlias ?? getTitleForSlug(slugMatch, ctx) ?? trimmedTarget
      nodes.push(
        <a href={href} class="internal">
          {label}
        </a>,
      )
    } else {
      const fallback = trimmedAlias ?? (trimmedTarget.length > 0 ? trimmedTarget : match)
      nodes.push(fallback)
    }

    lastIndex = index + match.length
    return match
  })

  if (lastIndex < raw.length) {
    nodes.push(raw.slice(lastIndex))
  }

  if (nodes.length === 0) {
    return ""
  }

  if (nodes.length === 1) {
    return nodes[0]
  }

  return nodes
}

const normalizeValue = (
  value: unknown,
  slug: FullSlug,
  ctx: QuartzComponentProps["ctx"],
): { node: ComponentChildren; key: string } | undefined => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeValue(entry, slug, ctx))
      .filter((entry): entry is { node: ComponentChildren; key: string } => Boolean(entry))

    if (normalized.length === 0) {
      return undefined
    }

    const combinedKey = normalized.map((entry) => entry.key).join("|")
    const children = intersperse(normalized.map((entry) => entry.node), ", ")
    return { node: <Fragment>{children}</Fragment>, key: combinedKey }
  }

  const text = normalizeString(value)
  if (!text) {
    return undefined
  }

  return { node: renderTextWithWikilinks(text, slug, ctx), key: text }
}

const appendAssetVersion = (url: string, version: string): string => {
  if (!version) {
    return url
  }

  return url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`
}

const resolveObsidianTarget = (rawTarget: string, slug: FullSlug): string => {
  const version = getAssetVersion()

  if (isExternalUrl(rawTarget)) {
    return rawTarget
  }

  const targetWithoutExt = stripContentPrefix(rawTarget) as FilePath
  const targetSlug = slugifyFilePath(targetWithoutExt)
  const baseDir = pathToRoot(slug)
  return appendAssetVersion(joinSegments(baseDir, targetSlug), version)
}

const resolveImageSource = (raw: string, slug: FullSlug): string | undefined => {
  const cleaned = raw.trim()
  if (!cleaned) {
    return undefined
  }

  const obsidianMatch = cleaned.match(OBSIDIAN_EMBED_PATTERN)
  if (obsidianMatch?.groups?.target) {
    return resolveObsidianTarget(obsidianMatch.groups.target, slug)
  }

  if (isExternalUrl(cleaned)) {
    return cleaned
  }

  const version = getAssetVersion()
  const target = stripContentPrefix(cleaned)
  return appendAssetVersion(joinSegments(pathToRoot(slug), target), version)
}

const parseItems = (
  rawItems: unknown,
  slug: FullSlug,
  ctx: QuartzComponentProps["ctx"],
): NormalizedInfoBoxItem[] => {
  if (!Array.isArray(rawItems)) {
    return []
  }

  const parsed: NormalizedInfoBoxItem[] = []
  ;(rawItems as FrontmatterInfoBoxItem[]).forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return
    }

    const label = normalizeString(item.label)
    if (!label) {
      return
    }

    const normalized = normalizeValue(item.value, slug, ctx)
    if (!normalized) {
      return
    }

    parsed.push({ label, value: normalized.node, key: `${label}-${index}-${normalized.key}` })
  })

  return parsed
}

const parseInfoBox = (
  frontmatter: Record<string, unknown>,
  slug: FullSlug,
  ctx: QuartzComponentProps["ctx"],
): NormalizedInfoBox | null => {
  const raw = frontmatter?.infobox as FrontmatterInfoBox | undefined
  if (!raw || typeof raw !== "object") {
    return null
  }

  const title = normalizeString(raw.title)
  const items = parseItems(raw.items, slug, ctx)

  const imageSrcRaw = normalizeString(raw.image?.src)
  const imageSrc = imageSrcRaw ? resolveImageSource(imageSrcRaw, slug) : undefined
  const imageAlt = normalizeString(raw.image?.alt)
  const imageCaption = normalizeString(raw.image?.caption)

  if (!title && !imageSrc && items.length === 0) {
    return null
  }

  const image = imageSrc
    ? {
        src: imageSrc,
        alt: imageAlt,
        caption: imageCaption,
      }
    : undefined

  return {
    title,
    image,
    items,
  }
}

export default (() => {
  const InfoBox: QuartzComponent = ({ fileData, displayClass, ctx }: QuartzComponentProps) => {
    if (!fileData?.frontmatter || !fileData.slug) {
      return null
    }

  const infobox = parseInfoBox(fileData.frontmatter as Record<string, unknown>, fileData.slug, ctx)
    if (!infobox) {
      return null
    }

    return (
      <aside class={classNames(displayClass, "infobox")} role="complementary" aria-label="Infobox">
        {infobox.title ? <h3 class="infobox__title">{infobox.title}</h3> : null}
        {infobox.image ? (
          <figure class="infobox__media">
            <img src={infobox.image.src} alt={infobox.image.alt ?? infobox.title ?? "Infobox image"} loading="lazy" decoding="async" />
            {infobox.image.caption ? <figcaption>{infobox.image.caption}</figcaption> : null}
          </figure>
        ) : null}
        {infobox.items.length > 0 ? (
          <dl class="infobox__facts">
            {infobox.items.map(({ label, value }) => (
              <div class="infobox__fact" key={`${label}-${value}`}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </aside>
    )
  }

  InfoBox.css = `
.infobox {
  float: right;
  margin: 0 0 1.5rem 1.5rem;
  width: clamp(220px, 28vw, 320px);
  background: var(--lightgray);
  border: 1px solid var(--gray);
  border-radius: 14px;
  padding: 1.25rem 1.25rem 1.5rem;
  box-shadow: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.12);
  position: sticky;
  top: clamp(1.5rem, 6vh, 4rem);
  z-index: 2;
}

.infobox__title {
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 1rem 0;
  text-align: center;
}

.infobox__media {
  margin: 0 0 1rem 0;
  display: grid;
  gap: 0.5rem;
}

.infobox__media img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  box-shadow: 0 0.75rem 1.5rem rgba(0, 0, 0, 0.18);
  background: var(--lightgray);
}


.infobox__media figcaption {
  font-size: 0.85rem;
  color: var(--darkgray);
  text-align: center;
}

.infobox__facts {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.infobox__fact {
  display: grid;
  gap: 0.35rem;
}

.infobox__fact dt {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--darkgray);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.infobox__fact dd {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.35;
  color: var(--gray);
}

@media (max-width: 1024px) {
  .infobox {
    position: relative;
    top: auto;
    float: none;
    margin: 1.5rem auto;
    width: min(100%, 420px);
  }
}
  `

  return InfoBox
}) satisfies QuartzComponentConstructor
