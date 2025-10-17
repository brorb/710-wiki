import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import homepageScript from "./scripts/homepage.inline"

type LinkConfig = {
  label: string
  href: string
  description?: string
}

type MaybeLink = Partial<LinkConfig> | undefined

type FrontmatterLinks = {
  archive?: MaybeLink
  discord?: MaybeLink
}

const DEFAULT_LINKS: Record<"archive" | "discord", LinkConfig> = {
  archive: {
    label: "Visit the Archive Channel",
    href: "https://www.youtube.com/@SleuthMedia",
    description: "Catch up on reuploads, VODs, and finds from across the community.",
  },
  discord: {
    label: "Join the Sleuths Discord",
    href: "https://discord.gg/cRFFHYye7t",
    description: "Coordinate puzzle solving, share theories, and keep watch on live drops.",
  },
}

const toLink = (candidate: MaybeLink, fallback: LinkConfig): LinkConfig => {
  if (!candidate || typeof candidate !== "object") {
    return fallback
  }

  const label = typeof candidate.label === "string" && candidate.label.trim().length > 0
    ? candidate.label.trim()
    : fallback.label

  const href = typeof candidate.href === "string" && candidate.href.trim().length > 0
    ? candidate.href.trim()
    : fallback.href

  const description = typeof candidate.description === "string" && candidate.description.trim().length > 0
    ? candidate.description.trim()
    : fallback.description

  return { label, href, description }
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
        <div class="home-features__intro">
          <div class="home-random">
            <h2 class="home-random__title">Start with a random article</h2>
            <p class="home-random__body">
              Not sure where to dive in? Let the wiki pick a page at random.
            </p>
            <button type="button" class="home-random__button" data-home-random-button>
              Surprise me
            </button>
            <p class="home-random__result" data-home-random-result aria-live="polite" hidden>
              <span class="home-random__result-label">You landed on:</span>{" "}
              <a class="home-random__link" data-home-random-link href="#">
                Generating…
              </a>
            </p>
          </div>
          <div class="home-links">
            <h2 class="home-links__title">Stay connected</h2>
            <div class="home-links__grid">
              <a
                class="home-link-card"
                href={archiveLink.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="home-link-card__label">{archiveLink.label}</span>
                <span class="home-link-card__description">{archiveLink.description}</span>
              </a>
              <a
                class="home-link-card"
                href={discordLink.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="home-link-card__label">{discordLink.label}</span>
                <span class="home-link-card__description">{discordLink.description}</span>
              </a>
            </div>
          </div>
        </div>
        <section class="home-recent">
          <div class="home-recent__header">
            <h2 class="home-recent__title">Recently updated</h2>
            <p class="home-recent__subtitle">
              Fresh edits and new clues from across the archive.
            </p>
          </div>
          <ol class="home-recent__list" data-home-recent-list>
            <li class="home-recent__empty">Loading recent updates…</li>
          </ol>
        </section>
      </section>
    )
  }

  HomepageFeatures.css = `
.home-features {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  margin-bottom: 3rem;
}

.home-features__intro {
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  align-items: stretch;
}

.home-random {
  padding: 1.75rem;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--secondary) 0%, rgba(255, 255, 255, 0) 65%), var(--lightgray);
  border: 1px solid var(--secondary);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.12);
  color: var(--dark);
}

.home-random__title {
  margin: 0 0 0.75rem;
  font-size: clamp(1.25rem, 2vw + 0.5rem, 1.6rem);
}

.home-random__body {
  margin: 0 0 1.25rem;
  max-width: 36ch;
  color: var(--darkgray);
}

.home-random__button {
  appearance: none;
  padding: 0.75rem 1.4rem;
  border-radius: 999px;
  border: none;
  background: var(--dark);
  color: var(--light);
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.home-random__button:hover,
.home-random__button:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(0, 0, 0, 0.18);
}

.home-random__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.home-random__result {
  margin: 1rem 0 0;
  font-size: 0.95rem;
  color: var(--dark);
}

.home-random__result a {
  font-weight: 600;
}

.home-links {
  padding: 1.75rem;
  border-radius: 18px;
  background: var(--lightgray);
  border: 1px solid var(--gray);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.home-links__title {
  margin: 0;
  font-size: clamp(1.2rem, 1.8vw + 0.4rem, 1.5rem);
}

.home-links__grid {
  display: grid;
  gap: 1.1rem;
}

.home-link-card {
  display: block;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: var(--light);
  border: 1px solid var(--lightgray);
  text-decoration: none;
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}

.home-link-card:hover,
.home-link-card:focus-visible {
  transform: translateY(-2px);
  border-color: var(--secondary);
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.14);
}

.home-link-card__label {
  display: block;
  font-weight: 600;
  color: var(--dark);
}

.home-link-card__description {
  display: block;
  margin-top: 0.35rem;
  color: var(--darkgray);
  font-size: 0.95rem;
}

.home-recent {
  padding: 2rem;
  border-radius: 22px;
  background: var(--lightgray);
  border: 1px solid var(--gray);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.1);
}

.home-recent__header {
  margin-bottom: 1.25rem;
}

.home-recent__title {
  margin: 0;
  font-size: clamp(1.3rem, 2vw + 0.5rem, 1.6rem);
}

.home-recent__subtitle {
  margin: 0.35rem 0 0;
  color: var(--darkgray);
}

.home-recent__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.9rem;
}

.home-recent__item {
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: var(--light);
  border: 1px solid var(--lightgray);
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.home-recent__item:hover,
.home-recent__item:focus-within {
  border-color: var(--secondary);
  box-shadow: 0 14px 26px rgba(0, 0, 0, 0.12);
}

.home-recent__link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  color: var(--dark);
  text-decoration: none;
}

.home-recent__link::after {
  content: "→";
  font-size: 0.9rem;
  opacity: 0.8;
  transform: translateY(-1px);
}

.home-recent__meta {
  margin-top: 0.45rem;
  font-size: 0.9rem;
  color: var(--darkgray);
}

.home-recent__time {
  font-variant-numeric: tabular-nums;
}

.home-recent__empty {
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: var(--light);
  border: 1px dashed var(--gray);
  color: var(--darkgray);
  text-align: center;
}

@media (max-width: 600px) {
  .home-random,
  .home-links,
  .home-recent {
    padding: 1.5rem;
  }

  .home-recent__list {
    gap: 0.75rem;
  }
}
`

  HomepageFeatures.afterDOMLoaded = homepageScript

  return HomepageFeatures
}) satisfies QuartzComponentConstructor
