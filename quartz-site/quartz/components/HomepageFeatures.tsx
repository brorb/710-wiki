import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import homepageScript from "./scripts/homepage.inline"

type LinkConfig = {
  label: string
  href: string
  description?: string
  iconSlug: string
}

type MaybeLink = Partial<LinkConfig> | undefined

type FrontmatterLinks = {
  archive?: MaybeLink
  discord?: MaybeLink
}

const iconPath = (slug: string) => `/static/icons/${slug}_icon.svg`

const DEFAULT_LINKS: Record<"archive" | "discord", LinkConfig> = {
  archive: {
    label: "Visit the Archive Channel",
    href: "https://www.youtube.com/@SleuthMedia",
    description: "Catch up on reuploads, VODs, and finds from across the community.",
    iconSlug: "youtube",
  },
  discord: {
    label: "Join the Sleuths Discord",
    href: "https://discord.gg/cRFFHYye7t",
    description: "Coordinate puzzle solving, share theories, and keep watch on live drops.",
    iconSlug: "discord",
  },
}

const toLink = (candidate: MaybeLink, fallback: LinkConfig): LinkConfig => {
  if (!candidate || typeof candidate !== "object") {
    return fallback
  }

  const label =
    typeof candidate.label === "string" && candidate.label.trim().length > 0
      ? candidate.label.trim()
      : fallback.label

  const href =
    typeof candidate.href === "string" && candidate.href.trim().length > 0
      ? candidate.href.trim()
      : fallback.href

  const description =
    typeof candidate.description === "string" && candidate.description.trim().length > 0
      ? candidate.description.trim()
      : fallback.description

  const iconSlug =
    typeof candidate.iconSlug === "string" && candidate.iconSlug.trim().length > 0
      ? candidate.iconSlug.trim()
      : fallback.iconSlug

  return { label, href, description, iconSlug }
}

export default (() => {
  const HomepageFeatures: QuartzComponent = ({ displayClass, fileData }: QuartzComponentProps) => {
    const frontmatter = (fileData.frontmatter ?? {}) as Record<string, unknown>
    const linksRaw = frontmatter.homepageLinks
    const homepageLinks =
      linksRaw && typeof linksRaw === "object"
        ? (linksRaw as FrontmatterLinks)
        : ({} as FrontmatterLinks)

    const archiveLink = toLink(homepageLinks.archive, DEFAULT_LINKS.archive)
    const discordLink = toLink(homepageLinks.discord, DEFAULT_LINKS.discord)

    return (
      <section class={classNames(displayClass, "home-features")} data-home-root>
        <section class="home-recent">
          <div class="home-recent__header">
            <h2 class="home-recent__title">Recently updated</h2>
            <p class="home-recent__subtitle">Fresh edits and new clues from across the archive.</p>
          </div>
          <ol class="home-recent__list" data-home-recent-list>
            <li class="home-recent__empty">Loading recent updates…</li>
          </ol>
        </section>
        <div class="home-actions">
          <div class="home-card home-random">
            <h3 class="home-card__title">Jump to a random article</h3>
            <p class="home-card__body">
              Feeling adventurous? Head straight to a random page pulled from the archive.
            </p>
            <button type="button" class="home-random__button" data-home-random-button>
              Take me there
            </button>
            <p class="home-random__empty" data-home-random-empty hidden>
              No eligible pages yet.
            </p>
          </div>
          <div class="home-card home-links">
            <h3 class="home-card__title">Stay connected</h3>
            <div class="home-links__stack">
              <a
                class="home-link-card"
                href={archiveLink.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="home-link-card__icon" aria-hidden="true">
                  <img src={iconPath(archiveLink.iconSlug)} alt="" loading="lazy" decoding="async" />
                </span>
                <span class="home-link-card__copy">
                  <span class="home-link-card__label">{archiveLink.label}</span>
                  <span class="home-link-card__description">{archiveLink.description}</span>
                </span>
              </a>
              <a
                class="home-link-card"
                href={discordLink.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="home-link-card__icon" aria-hidden="true">
                  <img src={iconPath(discordLink.iconSlug)} alt="" loading="lazy" decoding="async" />
                </span>
                <span class="home-link-card__copy">
                  <span class="home-link-card__label">{discordLink.label}</span>
                  <span class="home-link-card__description">{discordLink.description}</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>
    )
  }

  HomepageFeatures.css = `
.home-features {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin: 2.5rem 0 1.5rem;
}

.home-recent {
  padding: 1.25rem 1.5rem;
  border-radius: 16px;
  background: var(--lightgray);
  border: 1px solid var(--gray);
}

.home-recent__header {
  margin-bottom: 0.8rem;
}

.home-recent__title {
  margin: 0;
  font-size: clamp(1.15rem, 1.4vw + 0.6rem, 1.45rem);
}

.home-recent__subtitle {
  margin: 0.25rem 0 0;
  color: var(--darkgray);
  font-size: 0.9rem;
}

.home-recent__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.home-recent__item {
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: var(--light);
  border: 1px solid var(--lightgray);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.home-recent__item:hover,
.home-recent__item:focus-within {
  border-color: var(--secondary);
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.1);
}

.home-recent__link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  color: var(--dark);
  text-decoration: none;
}

.home-recent__link::after {
  content: "→";
  font-size: 0.85rem;
  opacity: 0.7;
}

.home-recent__meta {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--darkgray);
}

.home-recent__time {
  font-variant-numeric: tabular-nums;
}

.home-recent__empty {
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: var(--light);
  border: 1px dashed var(--gray);
  color: var(--darkgray);
  text-align: center;
  font-size: 0.9rem;
}

.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.home-card {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.1rem 1.25rem;
  border-radius: 14px;
  background: var(--lightgray);
  border: 1px solid var(--gray);
}

.home-card__title {
  margin: 0;
  font-size: clamp(1.05rem, 1vw + 0.6rem, 1.3rem);
}

.home-card__body {
  margin: 0;
  color: var(--darkgray);
  font-size: 0.92rem;
}

.home-random__button {
  align-self: flex-start;
  appearance: none;
  padding: 0.55rem 1.05rem;
  border-radius: 999px;
  border: none;
  background: var(--dark);
  color: var(--light);
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
}

.home-random__button:hover,
.home-random__button:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(0, 0, 0, 0.16);
}

.home-random__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.home-random__empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--darkgray);
}

.home-links__stack {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.home-link-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: var(--light);
  border: 1px solid var(--lightgray);
  text-decoration: none;
  transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
}

.home-link-card:hover,
.home-link-card:focus-visible {
  border-color: var(--secondary);
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.12);
}

.home-link-card__icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--lightgray);
  border: 1px solid var(--gray);
}

.home-link-card__icon img {
  width: 22px;
  height: 22px;
}

.home-link-card__copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.home-link-card__label {
  font-weight: 600;
  color: var(--dark);
}

.home-link-card__description {
  color: var(--darkgray);
  font-size: 0.85rem;
  line-height: 1.2;
}

@media (max-width: 640px) {
  .home-recent {
    padding: 1.1rem 1.2rem;
  }

  .home-card {
    padding: 1rem 1.1rem;
  }
}
`

  HomepageFeatures.afterDOMLoaded = homepageScript

  return HomepageFeatures
}) satisfies QuartzComponentConstructor
