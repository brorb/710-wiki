import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

import style from "../styles/folderDirectory.scss"
import type { SortFn } from "../PageList"
import { byDateAndAlphabeticalFolderFirst } from "../PageList"
import { Root } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { QuartzPluginData } from "../../plugins/vfile"
import { ComponentChildren, Fragment } from "preact"
import { concatenateResources } from "../../util/resources"
import { trieFromAllFiles } from "../../util/ctx"
import { Date as DateDisplay, getDate } from "../Date"
import {
  FilePath,
  FullSlug,
  joinSegments,
  pathToRoot,
  resolveRelative,
  slugifyFilePath,
} from "../../util/path"
import { getAssetVersion } from "../../util/assetVersion"

interface FolderContentOptions {
  /**
   * Whether to display number of folders
   */
  showFolderCount: boolean
  sort?: SortFn
  showSubfolders: boolean
}

const defaultOptions: FolderContentOptions = {
  showFolderCount: true,
  showSubfolders: true,
}

const OBSIDIAN_EMBED_PATTERN = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/
const isExternalUrl = (url: string) => /^(https?:)?\/\//i.test(url)
const stripContentPrefix = (target: string): string =>
  target.replace(/^[./]+/, "").replace(/^content\//i, "")
const appendAssetVersion = (url: string, version: string): string =>
  version ? (url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`) : url

const resolveAssetReference = (raw: unknown, baseSlug: FullSlug): string | undefined => {
  if (typeof raw !== "string") {
    return undefined
  }

  const cleaned = raw.trim()
  if (!cleaned) {
    return undefined
  }

  const version = getAssetVersion()
  const embedMatch = cleaned.match(OBSIDIAN_EMBED_PATTERN)
  if (embedMatch?.groups?.target) {
    const target = stripContentPrefix(embedMatch.groups.target)
    try {
      const slug = slugifyFilePath(target as FilePath)
      return appendAssetVersion(joinSegments(pathToRoot(baseSlug), slug), version)
    } catch {
      return undefined
    }
  }

  if (isExternalUrl(cleaned)) {
    return cleaned
  }

  const target = stripContentPrefix(cleaned)
  return appendAssetVersion(joinSegments(pathToRoot(baseSlug), target), version)
}

const normalizeSnippet = (value?: string, limit = 240): string | undefined => {
  if (!value) {
    return undefined
  }

  const compact = value.replace(/\s+/g, " ").trim()
  if (!compact) {
    return undefined
  }

  return compact.length > limit ? `${compact.slice(0, limit - 1).trimEnd()}…` : compact
}

const getSnippetForPage = (page: QuartzPluginData, fallback?: string): string | undefined => {
  const frontmatter = (page.frontmatter ?? {}) as Record<string, unknown>
  const candidates = [
    typeof page.description === "string" ? page.description : undefined,
    typeof frontmatter.description === "string" ? (frontmatter.description as string) : undefined,
    typeof page.text === "string" ? page.text : undefined,
  ]

  for (const candidate of candidates) {
    const snippet = normalizeSnippet(candidate)
    if (snippet) {
      return snippet
    }
  }

  return fallback
}

const getPrimaryImage = (page: QuartzPluginData, slug: FullSlug): string | undefined => {
  const frontmatter = (page.frontmatter ?? {}) as Record<string, unknown>
  const candidates = [
    (page.infobox as { image?: { src?: unknown } } | undefined)?.image?.src,
    frontmatter.cover,
    frontmatter.banner,
    frontmatter.image,
    frontmatter.thumbnail,
  ]

  for (const candidate of candidates) {
    const resolved = resolveAssetReference(candidate, slug)
    if (resolved) {
      return resolved
    }
  }

  return undefined
}

const getInitials = (title: string): string => {
  const parts = title
    .split(/\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")

  const initials = parts.join("")
  return initials.length > 0 ? initials : title.slice(0, 2).toUpperCase()
}

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`

export default ((opts?: Partial<FolderContentOptions>) => {
  const options: FolderContentOptions = { ...defaultOptions, ...opts }

  const FolderContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles, cfg } = props

    const trie = (props.ctx.trie ??= trieFromAllFiles(allFiles))
    const folder = trie.findNode(fileData.slug!.split("/"))
    if (!folder) {
      return null
    }

    type FolderNode = (typeof folder.children)[number]
    type FolderEntry = { node: FolderNode; data: QuartzPluginData }

    const getMostRecentDates = (node: FolderNode): QuartzPluginData["dates"] => {
      let maybeDates: QuartzPluginData["dates"] | undefined
      for (const child of node.children) {
        if (child.data?.dates) {
          const childDates = child.data.dates
          if (!maybeDates) {
            maybeDates = { ...childDates }
          } else {
            if (childDates.created > maybeDates.created) {
              maybeDates.created = childDates.created
            }
            if (childDates.modified > maybeDates.modified) {
              maybeDates.modified = childDates.modified
            }
            if (childDates.published > maybeDates.published) {
              maybeDates.published = childDates.published
            }
          }
        }
      }

      return (
        maybeDates ?? {
          created: new Date(),
          modified: new Date(),
          published: new Date(),
        }
      )
    }

    const entries: FolderEntry[] =
      folder.children
        .map((node) => {
          if (node.data) {
            return { node, data: node.data }
          }

          if (node.isFolder && options.showSubfolders) {
            const synthetic: QuartzPluginData = {
              slug: node.slug,
              dates: getMostRecentDates(node),
              frontmatter: {
                title: node.displayName,
                tags: [],
              },
            }
            return { node, data: synthetic }
          }

          return null
        })
        .filter((entry): entry is FolderEntry => entry !== null) ?? []

    const sortFn = options.sort ?? byDateAndAlphabeticalFolderFirst(cfg)
    const sortedEntries = [...entries].sort((a, b) => sortFn(a.data, b.data))
    const folderEntries = options.showSubfolders
      ? sortedEntries.filter((entry) => entry.node.isFolder)
      : []
    const pageEntries = sortedEntries.filter((entry) => !entry.node.isFolder || !options.showSubfolders)

    const countRenderableChildren = (node: FolderNode): number =>
      node.children.filter((child) => child.data || child.isFolder).length

    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")
    const content = (
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    ) as ComponentChildren

    return (
      <div class="popover-hint">
        <article class={classes}>{content}</article>
        <div class="folder-directory">
          {folderEntries.length > 0 && (
            <section class="folder-directory__section" aria-label="Subfolders">
              <div class="folder-directory__section-header">
                <h2 class="folder-directory__section-title">Collections</h2>
                <span class="folder-directory__section-hint">
                  {pluralize(folderEntries.length, "subfolder", "subfolders")}
                </span>
              </div>
              <div class="folder-directory__grid folder-directory__grid--subfolders">
                {folderEntries.map((entry) => {
                  const slug = entry.data.slug as FullSlug | undefined
                  if (!slug) {
                    return null
                  }

                  const title =
                    entry.data.frontmatter?.title ??
                    entry.node.displayName ??
                    slug.split("/").at(-1) ??
                    "Untitled"
                  const link = resolveRelative(fileData.slug!, slug)
                  const childCount = pluralize(countRenderableChildren(entry.node), "item", "items")
                  const updated = entry.data.dates ? getDate(cfg, entry.data) : undefined
                  const snippet = getSnippetForPage(entry.data)
                  const hasSnippet = Boolean(snippet)
                  const initials = getInitials(title)
                  const previewCandidates = entry.node.children.filter(
                    (child) => child.data && !child.isFolder,
                  )
                  const previewPages = previewCandidates.slice(0, 12)
                  const totalPreviewCount = previewCandidates.length
                  const safeSlugId = slug.replace(/[^a-zA-Z0-9_-]/g, "-")
                  const headingId = `directory-card-title-${safeSlugId}`

                  return (
                    <article
                      class="directory-card directory-card--folder"
                      key={slug}
                      data-href={link}
                      role="link"
                      tabIndex={0}
                      aria-labelledby={headingId}
                    >
                      <div class="directory-card__body directory-card__body--folder">
                        <div class="directory-card__content directory-card__content--folder">
                          <div class="directory-card__topline">
                            <div class="directory-card__header">
                              <span class="folder-directory__subfolder-icon" aria-hidden="true">
                                {initials}
                              </span>
                              <div>
                                <h3 class="directory-card__title" id={headingId}>
                                  {title}
                                </h3>
                                <p class="directory-card__meta">
                                  {childCount}
                                  {updated && (
                                    <Fragment>
                                      {" · "}
                                      Updated <DateDisplay date={updated} locale={cfg.locale} />
                                    </Fragment>
                                  )}
                                </p>
                              </div>
                            </div>
                            {previewPages.length > 0 && (
                              <div
                                class="directory-card__preview-wrap"
                                aria-label={`Highlights from ${title}`}
                                data-preview-total={totalPreviewCount}
                              >
                                <div class="directory-card__preview-list">
                                  {previewPages.map((child) => {
                                    const childData = child.data!
                                    const childFrontmatter = (childData.frontmatter ?? {}) as Record<string, unknown>
                                    const childTitle =
                                      typeof childFrontmatter.title === "string" && childFrontmatter.title.length > 0
                                        ? (childFrontmatter.title as string)
                                        : child.displayName ??
                                          childData.slug?.split("/").at(-1) ??
                                          "Untitled"

                                    return (
                                      <div class="directory-card__preview-card" key={childData.slug ?? childTitle}>
                                        <p class="directory-card__preview-title">{childTitle}</p>
                                      </div>
                                    )
                                  })}
                                </div>
                                <span class="directory-card__preview-more" aria-hidden="true" hidden>
                                  . . .
                                </span>
                              </div>
                            )}
                          </div>
                          {hasSnippet && <p class="directory-card__excerpt">{snippet}</p>}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {pageEntries.length > 0 && (
            <section class="folder-directory__section" aria-label="Entries">
              <div class="folder-directory__section-header">
                <h2 class="folder-directory__section-title">Entries</h2>
                <span class="folder-directory__section-hint">
                  {pluralize(pageEntries.length, "entry", "entries")}
                </span>
              </div>
              <div class="folder-directory__grid">
                {pageEntries.map((entry) => {
                  const slug = entry.data.slug as FullSlug | undefined
                  if (!slug) {
                    return null
                  }

                  const frontmatter = (entry.data.frontmatter ?? {}) as Record<string, unknown>
                  const title =
                    typeof frontmatter.title === "string" && frontmatter.title.length > 0
                      ? (frontmatter.title as string)
                      : entry.node.displayName ??
                        slug.split("/").at(-1) ??
                        "Untitled"
                  const link = resolveRelative(fileData.slug!, slug)
                  const updated = entry.data.dates ? getDate(cfg, entry.data) : undefined
                  const snippet = getSnippetForPage(entry.data)
                  const hasSnippet = Boolean(snippet)
                  const image = getPrimaryImage(entry.data, slug)
                  const tags = Array.isArray(frontmatter.tags)
                    ? (frontmatter.tags as string[])
                    : []
                  const safeSlugId = slug.replace(/[^a-zA-Z0-9_-]/g, "-")
                  const headingId = `directory-card-title-${safeSlugId}`

                  return (
                    <article
                      class="directory-card"
                      key={slug}
                      data-href={link}
                      role="link"
                      tabIndex={0}
                      aria-labelledby={headingId}
                    >
                      <div class="directory-card__body">
                        <div class="directory-card__content">
                          <h3 class="directory-card__title" id={headingId}>
                            {title}
                          </h3>
                          {updated && (
                            <p class="directory-card__meta">
                              Updated <DateDisplay date={updated} locale={cfg.locale} />
                            </p>
                          )}
                          {hasSnippet && <p class="directory-card__excerpt">{snippet}</p>}
                        </div>
                        {image && (
                          <div class="directory-card__media">
                            <img src={image} alt="" loading="lazy" decoding="async" data-no-zoom="true" />
                          </div>
                        )}
                        {tags.length > 0 && (
                          <ul class="directory-card__tags directory-card__tags--after-media">
                            {tags.map((tag) => (
                              <li class="directory-card__tag" key={tag}>
                                <a
                                  class="directory-card__tag-link"
                                  href={resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)}
                                >
                                  #{tag}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    )
  }

  FolderContent.afterDOMLoaded = `
    (() => {
      const selector = '.directory-card[data-href]'
      let handlersBound = false

      const resolveCard = (target) =>
        target instanceof Element ? target.closest(selector) : null

      const isTagLink = (target) =>
        target instanceof Element && target.closest('.directory-card__tag-link')

      const navigate = (href, openInNewTab) => {
        if (!href) {
          return
        }

        const url = new URL(href, window.location.toString())
        if (openInNewTab) {
          window.open(url.toString(), '_blank', 'noopener')
          return
        }

        if (typeof window.spaNavigate === 'function') {
          window.spaNavigate(url)
        } else {
          window.location.assign(url)
        }
      }

      const handleClick = (event) => {
        if (event.defaultPrevented) {
          return
        }

        const card = resolveCard(event.target)
        if (!card) {
          return
        }

        if (isTagLink(event.target)) {
          return
        }

        if (window.getSelection && window.getSelection().toString().length > 0) {
          return
        }

        if (event.button !== 0) {
          return
        }

        event.preventDefault()
        navigate(card.getAttribute('data-href'), event.metaKey || event.ctrlKey)
      }

      const handleAuxClick = (event) => {
        if (event.defaultPrevented || event.button !== 1) {
          return
        }

        const card = resolveCard(event.target)
        if (!card || isTagLink(event.target)) {
          return
        }

        event.preventDefault()
        navigate(card.getAttribute('data-href'), true)
      }

      const handleKeydown = (event) => {
        if (event.defaultPrevented) {
          return
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }

        const target = event.target
        if (!(target instanceof HTMLElement)) {
          return
        }

        if (!target.matches(selector)) {
          return
        }

        event.preventDefault()
        navigate(target.getAttribute('data-href'), event.metaKey || event.ctrlKey)
      }

      const bindHandlers = () => {
        if (handlersBound) {
          return
        }

        document.addEventListener('click', handleClick)
        document.addEventListener('auxclick', handleAuxClick)
        document.addEventListener('keydown', handleKeydown)
        handlersBound = true

        window.addCleanup?.(() => {
          document.removeEventListener('click', handleClick)
          document.removeEventListener('auxclick', handleAuxClick)
          document.removeEventListener('keydown', handleKeydown)
          handlersBound = false
        })
      }

      const previewSelector = '.directory-card__preview-wrap'
      const previewElements = new Set()
      const previewObservers = new Map()
      let previewResizeHandler = null

      const getViewportPreviewCount = () => {
        const width = window.innerWidth || document.documentElement.clientWidth || 0
        const height = window.innerHeight || document.documentElement.clientHeight || 1
        const aspect = height > 0 ? width / height : 1

        if (width >= 1600 && aspect >= 1.5) {
          return 5
        }
        if (width >= 1280 && aspect >= 1.3) {
          return 4
        }
        if (width >= 960) {
          return 3
        }
        if (width >= 640) {
          return 2
        }
        return 1
      }

      const schedulePreviewUpdate = (wrap) => {
        window.requestAnimationFrame(() => updatePreviewLayout(wrap))
      }

      const updatePreviewLayout = (wrap) => {
        if (!(wrap instanceof HTMLElement)) {
          return
        }

        if (!wrap.isConnected) {
          const observer = previewObservers.get(wrap)
          if (observer) {
            observer.disconnect()
            previewObservers.delete(wrap)
          }
          previewElements.delete(wrap)
          return
        }

        const list = wrap.querySelector('.directory-card__preview-list')
        if (!(list instanceof HTMLElement)) {
          return
        }

        const cards = Array.from(list.querySelectorAll('.directory-card__preview-card'))
        const ellipsis = wrap.querySelector('.directory-card__preview-more')
        const total = Number.parseInt(wrap.getAttribute('data-preview-total') ?? '', 10) || cards.length

        if (cards.length === 0) {
          if (ellipsis) {
            ellipsis.hidden = total <= 0
          }
          return
        }

        const style = window.getComputedStyle(list)
        const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0
        const available = list.getBoundingClientRect().width
        const sampleCard = cards[0]
        const cardWidth = sampleCard ? sampleCard.getBoundingClientRect().width : 0

        let widthCapacity = Number.POSITIVE_INFINITY
        if (Number.isFinite(available) && available > 0 && Number.isFinite(cardWidth) && cardWidth > 0) {
          const maxByWidth = Math.floor((available + gap) / (cardWidth + gap))
          if (Number.isFinite(maxByWidth)) {
            widthCapacity = Math.max(1, maxByWidth)
          }
        }

        let baseline = Number.parseInt(wrap.getAttribute('data-preview-visible') ?? '', 10)
        if (!Number.isFinite(baseline) || baseline <= 0) {
          baseline = getViewportPreviewCount()
          if (!Number.isFinite(baseline) || baseline < 1) {
            baseline = 1
          }
          baseline = Math.min(baseline, cards.length)
          if (Number.isFinite(widthCapacity) && widthCapacity > 0) {
            baseline = Math.min(baseline, widthCapacity)
          }
          wrap.setAttribute('data-preview-visible', String(baseline))
        }

        let visibleCount = baseline
        if (Number.isFinite(widthCapacity) && widthCapacity > 0) {
          visibleCount = Math.min(visibleCount, widthCapacity)
        }

        visibleCount = Math.max(1, Math.min(visibleCount, cards.length))

        cards.forEach((card, index) => {
          card.toggleAttribute('hidden', index >= visibleCount)
        })

        const hiddenRendered = cards.length > visibleCount
        const shouldShowEllipsis = hiddenRendered || total > visibleCount
        if (ellipsis) {
          ellipsis.hidden = !shouldShowEllipsis
        }
      }

      const ensurePreviewResizeHandler = () => {
        if (previewResizeHandler) {
          return
        }

        previewResizeHandler = () => {
          previewElements.forEach((wrap) => schedulePreviewUpdate(wrap))
        }

        window.addEventListener('resize', previewResizeHandler)

        window.addCleanup?.(() => {
          if (previewResizeHandler) {
            window.removeEventListener('resize', previewResizeHandler)
            previewResizeHandler = null
          }
        })
      }

      const setupPreviewLayouts = () => {
        const wraps = document.querySelectorAll(previewSelector)
        wraps.forEach((element) => {
          if (!(element instanceof HTMLElement)) {
            return
          }

          previewElements.add(element)

          if (!previewObservers.has(element) && typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(() => schedulePreviewUpdate(element))
            observer.observe(element)
            previewObservers.set(element, observer)
          }

          schedulePreviewUpdate(element)
        })

        if (previewElements.size > 0) {
          ensurePreviewResizeHandler()
        }
      }

      const cleanupPreviews = () => {
        previewObservers.forEach((observer) => {
          if (observer && typeof observer.disconnect === 'function') {
            observer.disconnect()
          }
        })
        previewObservers.clear()
        previewElements.clear()
      }

      const handleNav = () => {
        bindHandlers()
        setupPreviewLayouts()
      }

      document.addEventListener('nav', handleNav)
      handleNav()

      window.addCleanup?.(() => {
        cleanupPreviews()
        document.removeEventListener('nav', handleNav)
      })
    })()
  `

  FolderContent.css = concatenateResources(style)
  return FolderContent
}) satisfies QuartzComponentConstructor
