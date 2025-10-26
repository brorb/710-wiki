import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { Date, getDate } from "./Date"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/shareButton.inline"

const SHARE_ICON_PATH =
  "M331,750 C329.343,750 328,748.657 328,747 C328,745.343 329.343,744 331,744 C332.657,744 334,745.343 334,747 C334,748.657 332.657,750 331,750 L331,750 Z M317,742 C315.343,742 314,740.657 314,739 C314,737.344 315.343,736 317,736 C318.657,736 320,737.344 320,739 C320,740.657 318.657,742 317,742 L317,742 Z M331,728 C332.657,728 334,729.343 334,731 C334,732.657 332.657,734 331,734 C329.343,734 328,732.657 328,731 C328,729.343 329.343,728 331,728 L331,728 Z M331,742 C329.23,742 327.685,742.925 326.796,744.312 L321.441,741.252 C321.787,740.572 322,739.814 322,739 C322,738.497 321.903,738.021 321.765,737.563 L327.336,734.38 C328.249,735.37 329.547,736 331,736 C333.762,736 336,733.762 336,731 C336,728.238 333.762,726 331,726 C328.238,726 326,728.238 326,731 C326,731.503 326.097,731.979 326.235,732.438 L320.664,735.62 C319.751,734.631 318.453,734 317,734 C314.238,734 312,736.238 312,739 C312,741.762 314.238,744 317,744 C318.14,744 319.179,743.604 320.02,742.962 L320,743 L326.055,746.46 C326.035,746.64 326,746.814 326,747 C326,749.762 328.238,752 331,752 C333.762,752 336,749.762 336,747 C336,744.238 333.762,742 331,742 L331,742 Z"

const resolveShareUrl = (cfg: QuartzComponentProps["cfg"], slug?: string | null): string | undefined => {
  if (!slug) {
    return undefined
  }

  const relativePath = slug === "index" ? "/" : `/${slug}`
  const normalizedPath = relativePath.endsWith("/") ? relativePath : `${relativePath}/`
  const rawBase = cfg.baseUrl?.trim()

  if (!rawBase) {
    return normalizedPath
  }

  const normalizedBase = rawBase.startsWith("http") ? rawBase : `https://${rawBase}`
  try {
    return new URL(normalizedPath, normalizedBase).toString()
  } catch {
    return normalizedPath
  }
}

const ArticleHeader: QuartzComponent = ({ cfg, fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title ?? fileData.slug ?? ""
  const updatedDate = fileData.dates ? getDate(cfg, fileData) : undefined
  const shareUrl = resolveShareUrl(cfg, fileData.slug)
  const shareText = fileData.description ?? fileData.frontmatter?.description ?? ""

  if (!title && !updatedDate) {
    return null
  }

  return (
    <header class={classNames(displayClass, "article-header")}>
      <div class="article-header__content">
        {title && <h1 class="article-title">{title}</h1>}
        {updatedDate && (
          <div class="article-header__meta">
            <span class="article-header__meta-label">Updated</span>
            <Date date={updatedDate} locale={cfg.locale} />
          </div>
        )}
      </div>
      {shareUrl && (
        <div class="article-share">
          <button
            type="button"
            class="article-share__button"
            aria-label={`Share ${title}`}
            data-share-url={shareUrl}
            data-share-title={title}
            data-share-text={shareText || undefined}
            data-share-copied="Link copied!"
            data-share-shared="Share dialog opened."
            data-share-error="Sharing not available."
            data-share-cancel="Share cancelled."
          >
            <span class="article-share__icon" aria-hidden="true">
              <svg viewBox="-1 0 26 26" role="img" focusable="false">
                <path d={SHARE_ICON_PATH} />
              </svg>
            </span>
          </button>
          <span class="article-share__feedback" aria-live="polite"></span>
        </div>
      )}
    </header>
  )
}

ArticleHeader.css = `
.article-header {
  margin: 2rem 0 1.85rem;
  padding-bottom: 0.85rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  border-bottom: 1px solid var(--color-accent-deep);
}

.article-header__content {
  flex: 1 1 auto;
  min-width: 0;
}

.article-header .article-title {
  margin: 0;
  color: var(--color-tone-contrast);
}

.article-header__meta {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin-top: 0.6rem;
  color: var(--color-tone-subtle);
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}

.article-header__meta time {
  color: inherit;
  font-weight: 500;
}

.article-header__meta-label {
  font-weight: 500;
  letter-spacing: 0.01em;
}

.article-share {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 0.2rem;
  min-width: fit-content;
  align-self: flex-end;
  margin-top: auto;
}

.article-share__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-accent-bright);
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease, transform 160ms ease;
}

.article-share__button:hover {
  color: var(--color-accent-deep);
  background: color-mix(in srgb, var(--color-accent-bright) 16%, transparent);
}

.article-share__button:active {
  transform: translateY(1px);
  background: color-mix(in srgb, var(--color-accent-deep) 18%, transparent);
}

.article-share__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
}

.article-share__button:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.article-share__icon svg {
  width: 20px;
  height: 20px;
  display: block;
  fill: currentColor;
}

.article-share__feedback {
  min-height: 1rem;
  font-size: 0.76rem;
  letter-spacing: 0.03em;
  color: var(--color-tone-primary);
  transition: opacity 160ms ease;
  opacity: 0;
}

.article-share__feedback[data-state="success"] {
  color: #7de49a;
  opacity: 1;
}

.article-share__feedback[data-state="error"] {
  color: #ff8a8a;
  opacity: 1;
}

@media (max-width: 640px) {
  .article-header {
    flex-direction: column;
    align-items: stretch;
  }

  .article-share {
    align-items: flex-start;
  }
}
`

// @ts-ignore - provided by inline script loader at build time
ArticleHeader.afterDOMLoaded = script

export default (() => ArticleHeader) satisfies QuartzComponentConstructor
