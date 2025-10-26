import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { Date, getDate } from "./Date"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/shareButton.inline"

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
            <span class="article-share__icon" aria-hidden="true"></span>
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

.article-share__icon {
  width: 20px;
  height: 20px;
  display: block;
  background-color: currentColor;
  mask-image: url("/static/icons/share_icon.svg");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: url("/static/icons/share_icon.svg");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
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
  color: var(--color-feedback-success);
  opacity: 1;
}

.article-share__feedback[data-state="error"] {
  color: var(--color-feedback-error);
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
