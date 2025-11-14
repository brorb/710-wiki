import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import listStyle from "../styles/listPage.scss"
import folderStyle from "../styles/folderDirectory.scss"
import { PageList, SortFn, byDateAndAlphabeticalFolderFirst } from "../PageList"
import {
  FilePath,
  FullSlug,
  getAllSegmentPrefixes,
  joinSegments,
  pathToRoot,
  resolveRelative,
  simplifySlug,
  slugifyFilePath,
} from "../../util/path"
import { QuartzPluginData } from "../../plugins/vfile"
import { Root } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { i18n } from "../../i18n"
import { ComponentChildren } from "preact"
import { concatenateResources } from "../../util/resources"
import { getAssetVersion } from "../../util/assetVersion"
import { Date as DateDisplay, getDate } from "../Date"
import { normalizeSnippet } from "../../util/snippet"

interface TagContentOptions {
  sort?: SortFn
  numPages: number
}

const defaultOptions: TagContentOptions = {
  numPages: 10,
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

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`

export default ((opts?: Partial<TagContentOptions>) => {
  const options: TagContentOptions = { ...defaultOptions, ...opts }

  const TagContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles, cfg } = props
    const slug = fileData.slug

    if (!(slug?.startsWith("tags/") || slug === "tags")) {
      throw new Error(`Component "TagContent" tried to render a non-tag page: ${slug}`)
    }

    const tag = simplifySlug(slug.slice("tags/".length) as FullSlug)
    const allPagesWithTag = (tag: string) =>
      allFiles.filter((file) =>
        (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes).includes(tag),
      )

    const content = (
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    ) as ComponentChildren
    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")
    if (tag === "/") {
      const tags = [
        ...new Set(
          allFiles.flatMap((data) => data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes),
        ),
      ].sort((a, b) => a.localeCompare(b))
      const tagItemMap: Map<string, QuartzPluginData[]> = new Map()
      for (const tag of tags) {
        tagItemMap.set(tag, allPagesWithTag(tag))
      }
      return (
        <div class="popover-hint">
          <article class={classes}>
            <p>{content}</p>
          </article>
          <p>{i18n(cfg.locale).pages.tagContent.totalTags({ count: tags.length })}</p>
          <div>
            {tags.map((tag) => {
              const pages = tagItemMap.get(tag)!
              const listProps = {
                ...props,
                allFiles: pages,
              }

              const contentPage = allFiles.filter((file) => file.slug === `tags/${tag}`).at(0)

              const root = contentPage?.htmlAst
              const content =
                !root || root?.children.length === 0
                  ? contentPage?.description
                  : htmlToJsx(contentPage.filePath!, root)

              const tagListingPage = `/tags/${tag}` as FullSlug
              const href = resolveRelative(fileData.slug!, tagListingPage)

              return (
                <div>
                  <h2>
                    <a class="internal tag-link" href={href}>
                      {tag}
                    </a>
                  </h2>
                  {content && <p>{content}</p>}
                  <div class="page-listing">
                    <p>
                      {i18n(cfg.locale).pages.tagContent.itemsUnderTag({ count: pages.length })}
                      {pages.length > options.numPages && (
                        <>
                          {" "}
                          <span>
                            {i18n(cfg.locale).pages.tagContent.showingFirst({
                              count: options.numPages,
                            })}
                          </span>
                        </>
                      )}
                    </p>
                    <PageList limit={options.numPages} {...listProps} sort={options?.sort} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    } else {
      const pages = allPagesWithTag(tag)
      const sortFn = options.sort ?? byDateAndAlphabeticalFolderFirst(cfg)
      const sortedPages = [...pages].sort(sortFn)
      const entriesSortSelectId = `tag-sort-${tag.replace(/[^a-zA-Z0-9_-]/g, "-")}`

      return (
        <div class="popover-hint">
          <article class={classes}>{content}</article>
          {sortedPages.length > 0 ? (
            <div class="folder-directory">
              <section
                class="folder-directory__section"
                aria-label={i18n(cfg.locale).pages.tagContent.itemsUnderTag({ count: sortedPages.length })}
              >
                <div class="folder-directory__section-header">
                  <h2 class="folder-directory__section-title">#{tag}</h2>
                  <div class="folder-directory__section-tools">
                    <span class="folder-directory__section-hint">
                      {pluralize(sortedPages.length, "entry", "entries")}
                    </span>
                    <label class="folder-directory__sort" htmlFor={entriesSortSelectId}>
                      <span class="folder-directory__sort-label">Sort by</span>
                      <select
                        class="folder-directory__sort-select"
                        id={entriesSortSelectId}
                        defaultValue="newest"
                        data-sort-target="entries"
                      >
                        <option value="newest">Date · Newest</option>
                        <option value="oldest">Date · Oldest</option>
                        <option value="alpha">Title · A → Z</option>
                        <option value="size">Size · Longest</option>
                        <option value="shortest">Size · Shortest</option>
                        <option value="random">Random</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div class="folder-directory__grid" data-sort-grid="entries">
                  {sortedPages.map((page) => {
                    const slug = page.slug as FullSlug | undefined
                    if (!slug) {
                      return null
                    }

                    const frontmatter = (page.frontmatter ?? {}) as Record<string, unknown>
                    const title =
                      typeof frontmatter.title === "string" && frontmatter.title.length > 0
                        ? (frontmatter.title as string)
                        : page.slug?.split("/").at(-1) ?? "Untitled"
                    const link = resolveRelative(fileData.slug!, slug)
                    const updated = page.dates ? getDate(cfg, page) : undefined
                    const snippet = getSnippetForPage(page)
                    const hasSnippet = Boolean(snippet)
                    const image = getPrimaryImage(page, slug)
                    const tags = Array.isArray(frontmatter.tags)
                      ? (frontmatter.tags as string[])
                      : []
                    const normalizedTitle = title.trim().toLocaleLowerCase()
                    const datasetTitle = normalizedTitle.length > 0 ? normalizedTitle : title.toLocaleLowerCase()
                    const pageText = typeof page.text === "string" ? page.text : ""
                    const contentSize = pageText.replace(/\s+/g, " ").trim().length
                    const updatedTimestamp = updated ? updated.getTime() : 0
                    const safeSlugId = slug.replace(/[^a-zA-Z0-9_-]/g, "-")
                    const headingId = `directory-card-title-${safeSlugId}`

                    return (
                      <article
                        class="directory-card"
                        key={slug}
                        data-href={link}
                        data-sort-title={datasetTitle}
                        data-sort-updated={String(updatedTimestamp)}
                        data-sort-size={String(contentSize)}
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
                              {tags.map((tagName) => (
                                <li class="directory-card__tag" key={tagName}>
                                  <a
                                    class="directory-card__tag-link"
                                    href={resolveRelative(fileData.slug!, `tags/${tagName}` as FullSlug)}
                                  >
                                    #{tagName}
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
            </div>
          ) : (
            <div class="folder-directory">
              <section class="folder-directory__section" aria-label="Empty tag">
                <div class="folder-directory__section-header">
                  <h2 class="folder-directory__section-title">#{tag}</h2>
                  <span class="folder-directory__section-hint">0 entries</span>
                </div>
                <p class="folder-directory__summary">No entries are currently tagged with this label.</p>
              </section>
            </div>
          )}
        </div>
      )
    }
  }

  TagContent.afterDOMLoaded = `
    (() => {
      const SORT_SELECT_SELECTOR = '.folder-directory__sort-select'
      const sortBindings = new Map()

      const parseSortNumber = (value) => {
        if (typeof value !== 'string' || value.length === 0) {
          return 0
        }
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : 0
      }

      const sortComparators = {
        newest: (a, b) => parseSortNumber(b.dataset.sortUpdated) - parseSortNumber(a.dataset.sortUpdated),
        oldest: (a, b) => parseSortNumber(a.dataset.sortUpdated) - parseSortNumber(b.dataset.sortUpdated),
        alpha: (a, b) => {
          const titleA = (a.dataset.sortTitle ?? '').toString()
          const titleB = (b.dataset.sortTitle ?? '').toString()
          return titleA.localeCompare(titleB)
        },
        size: (a, b) => parseSortNumber(b.dataset.sortSize) - parseSortNumber(a.dataset.sortSize),
        shortest: (a, b) => parseSortNumber(a.dataset.sortSize) - parseSortNumber(b.dataset.sortSize),
      }

      const getSortGridForSelect = (select) => {
        if (!(select instanceof HTMLSelectElement)) {
          return null
        }
        const target = select.getAttribute('data-sort-target')
        if (!target) {
          return null
        }
        const section = select.closest('.folder-directory__section')
        if (!section) {
          return null
        }
        const grid = section.querySelector('.folder-directory__grid[data-sort-grid="' + target + '"]')
        return grid instanceof HTMLElement ? grid : null
      }

      const applySortForSelect = (select) => {
        const grid = getSortGridForSelect(select)
        if (!grid) {
          return
        }

        const cards = Array.from(grid.querySelectorAll('.directory-card'))
        if (cards.length === 0) {
          return
        }

        const sortKey = select.value
        const comparator = sortComparators[sortKey] ?? sortComparators.newest
        const decorated = cards.map((card, index) => ({ card, index, random: Math.random() }))
        decorated.sort((a, b) => {
          if (sortKey === 'random') {
            const randomDiff = a.random - b.random
            return randomDiff !== 0 ? randomDiff : a.index - b.index
          }

          const result = comparator(a.card, b.card)
          return result !== 0 ? result : a.index - b.index
        })
        decorated.forEach(({ card }) => grid.appendChild(card))
      }

      const cleanupSortControls = () => {
        sortBindings.forEach((handler, element) => {
          element.removeEventListener('change', handler)
        })
        sortBindings.clear()
      }

      const pruneSortBindings = () => {
        Array.from(sortBindings.entries()).forEach(([element, handler]) => {
          if (!(element instanceof HTMLSelectElement) || !element.isConnected) {
            element.removeEventListener('change', handler)
            sortBindings.delete(element)
          }
        })
      }

      const bindSortControls = () => {
        pruneSortBindings()
        const selects = document.querySelectorAll(SORT_SELECT_SELECTOR)
        selects.forEach((element) => {
          if (!(element instanceof HTMLSelectElement)) {
            return
          }
          if (!element.closest('.folder-directory')) {
            return
          }
          if (!sortBindings.has(element)) {
            const handler = () => applySortForSelect(element)
            element.addEventListener('change', handler)
            sortBindings.set(element, handler)
          }
          applySortForSelect(element)
        })
      }

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

      const handleNav = () => {
        bindHandlers()
        bindSortControls()
      }

      document.addEventListener('nav', handleNav)
      handleNav()

      window.addCleanup?.(() => {
        document.removeEventListener('nav', handleNav)
        cleanupSortControls()
      })
    })()
  `

  TagContent.css = concatenateResources(folderStyle, listStyle, PageList.css)
  return TagContent
}) satisfies QuartzComponentConstructor
