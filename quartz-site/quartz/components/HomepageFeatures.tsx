import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import homepageScript from "./scripts/homepage.inline"

type LinkConfig = {
  label: string
  href: string
  description: string
  iconSlug: string
}

type FrontmatterLinkOverrides = Partial<LinkConfig>

type FrontmatterLinks = {
  archive?: FrontmatterLinkOverrides
  discord?: FrontmatterLinkOverrides
  reddit?: FrontmatterLinkOverrides
}

const DEFAULT_LINKS: Record<keyof FrontmatterLinks, LinkConfig> = {
  archive: {
    label: "Archival Channel",
    href: "https://www.youtube.com/@710ToneArchiveChannel",
    description: "Follow the archive channel and view lost 7/10 Tone media",
    iconSlug: "youtube",
  },
  discord: {
    label: "Join the Discord",
    href: "https://discord.gg/2ByK7Xcmy4",
    description: "Swap theories and work puzzles with fellow sleuths",
    iconSlug: "discord",
  },
  reddit: {
    label: "Visit r/710Tone",
    href: "https://www.reddit.com/r/710Tone/",
    description: "Browse community finds and share what you uncover",
    iconSlug: "reddit",
  },
}

const toLink = (
  candidate: FrontmatterLinkOverrides | undefined,
  fallback: LinkConfig,
): LinkConfig => {
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
    const redditLink = toLink(homepageLinks.reddit, DEFAULT_LINKS.reddit)

    return (
      <section class={classNames(displayClass, "home-features")} data-home-root>
        <section class="home-recent">
          <h2 class="home-recent__title">Recently updated</h2>
          <div class="home-recent__scroller">
            <ol class="home-recent__list" data-home-recent-list>
              <li class="home-recent__empty">Loading recent updates…</li>
            </ol>
          </div>
        </section>
        <div class="home-actions">
          <div class="home-card home-random">
            <div class="home-random__frame">
              <button
                type="button"
                class="home-random__trigger"
                data-home-random-trigger
                aria-label="Roll a random article"
              >
                <span
                  class="home-random__dice"
                  aria-hidden="true"
                  data-home-random-dice
                  data-face="5"
                >
                  <span class="home-random__dice-face">
                    <span class="home-random__pip home-random__pip--top-left"></span>
                    <span class="home-random__pip home-random__pip--top-right"></span>
                    <span class="home-random__pip home-random__pip--mid-left"></span>
                    <span class="home-random__pip home-random__pip--center"></span>
                    <span class="home-random__pip home-random__pip--mid-right"></span>
                    <span class="home-random__pip home-random__pip--bottom-left"></span>
                    <span class="home-random__pip home-random__pip--bottom-right"></span>
                  </span>
                </span>
              </button>
              <div class="home-random__panel" data-home-random-panel>
                <div class="home-random__card" data-home-random-card>
                  <div
                    class="home-random-card home-random-card--placeholder"
                    data-home-random-placeholder
                    aria-hidden="true"
                  >
                    <h3 class="home-random-card__title" data-home-random-placeholder-title>
                      Try a random article!
                    </h3>
                    <p class="home-random-card__placeholder-copy" data-home-random-placeholder-copy>
                      Tap the die to roll the archive.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
                <span
                  class={`home-link-card__icon home-link-card__icon--${archiveLink.iconSlug}`}
                  aria-hidden="true"
                />
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
                <span
                  class={`home-link-card__icon home-link-card__icon--${discordLink.iconSlug}`}
                  aria-hidden="true"
                />
                <span class="home-link-card__copy">
                  <span class="home-link-card__label">{discordLink.label}</span>
                  <span class="home-link-card__description">{discordLink.description}</span>
                </span>
              </a>
              <a
                class="home-link-card"
                href={redditLink.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span
                  class={`home-link-card__icon home-link-card__icon--${redditLink.iconSlug}`}
                  aria-hidden="true"
                />
                <span class="home-link-card__copy">
                  <span class="home-link-card__label">{redditLink.label}</span>
                  <span class="home-link-card__description">{redditLink.description}</span>
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.home-recent {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.home-recent__title {
  margin: 0;
  font-size: clamp(1.1rem, 1.2vw + 0.6rem, 1.35rem);
}

.home-recent__scroller {
  --home-recent-gutter: 0.75rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 0 var(--home-recent-gutter);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scroll-behavior: smooth;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable both-edges;
}

body:not(.hide-scrollbars) .home-recent__scroller::-webkit-scrollbar {
  height: 6px;
}

body:not(.hide-scrollbars) .home-recent__scroller::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-tone-muted) 45%, transparent);
  border-radius: 999px;
}

.home-recent__list {
  list-style: none;
  margin: 0;
  padding: 0 0 0.2rem;
  display: flex;
  gap: 0.85rem;
  width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
  align-items: stretch;
}

.home-recent-card {
  flex: 0 0 clamp(240px, 22vw + 110px, 300px);
  display: flex;
  scroll-snap-align: start;
}

.home-recent-card__link {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  width: 100%;
  min-height: 100%;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-surface-overlay) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.18),
    0 1px 0 color-mix(in srgb, var(--color-accent-shadow-light) 28%, transparent);
  text-decoration: none;
  color: var(--color-tone-contrast);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.home-recent-card__link:hover,
.home-recent-card__link:focus-visible {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--color-accent-bright) 50%, transparent);
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.22),
    0 1px 0 color-mix(in srgb, var(--color-accent-bright) 32%, transparent);
  outline: none;
}

.home-recent-card__title {
  margin: 0;
  font-size: clamp(1rem, 0.7vw + 0.8rem, 1.15rem);
  font-weight: 650;
  color: var(--color-tone-contrast);
  letter-spacing: 0.01em;
}


.home-recent-card__meta {
  margin: 0;
  font-size: 0.86rem;
  color: color-mix(in srgb, var(--color-tone-muted) 68%, var(--color-tone-contrast) 32%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.home-recent-card__meta time {
  font-variant-numeric: tabular-nums;
}

.home-recent-card__meta-label {
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--color-tone-muted) 72%, var(--color-accent-shadow-light) 28%);
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.home-recent__empty {
  flex: 0 0 clamp(240px, 22vw + 110px, 300px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 1.2rem;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-tone-muted) 18%, transparent);
  border: 1px dashed color-mix(in srgb, var(--color-tone-muted) 40%, transparent);
  color: color-mix(in srgb, var(--color-tone-muted) 80%, var(--color-tone-contrast) 20%);
  font-size: 0.9rem;
  scroll-snap-align: start;
  text-align: center;
}

.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  min-width: 0;
}

.home-card {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

.home-random__empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--darkgray);
}

.home-random__frame {
  display: flex;
  align-items: center;
  gap: 1.1rem;
}

.home-random__trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  min-width: 96px;
  aspect-ratio: 1;
  border: none;
  border-radius: 26px;
  cursor: pointer;
  background: color-mix(in srgb, var(--color-accent-bright) 30%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-accent-shadow) 50%, transparent),
    0 12px 26px rgba(0, 0, 0, 0.24);
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.home-random__trigger:focus-visible,
.home-random__trigger:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-accent-bright) 55%, transparent),
    0 16px 34px rgba(0, 0, 0, 0.28);
  outline: none;
}

.home-random__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-accent-shadow) 45%, transparent),
    0 8px 18px rgba(0, 0, 0, 0.18);
}

.home-random__dice {
  --home-random-dice-size: 62px;
  position: relative;
  display: grid;
  place-items: center;
  width: var(--home-random-dice-size);
  height: var(--home-random-dice-size);
  flex: 0 0 auto;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  box-sizing: border-box;
  transition: transform 180ms ease;
}

.home-random__dice-face {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: var(--light);
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  align-items: center;
  justify-items: center;
  padding: 6px;
  gap: 4px;
  box-sizing: border-box;
}

.home-random__pip {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--dark);
  opacity: 0;
  transition: opacity 120ms ease;
}

.home-random__pip--top-left {
  grid-area: 1 / 1;
}

.home-random__pip--top-right {
  grid-area: 1 / 3;
}

.home-random__pip--mid-left {
  grid-area: 2 / 1;
}

.home-random__pip--center {
  grid-area: 2 / 2;
}

.home-random__pip--mid-right {
  grid-area: 2 / 3;
}

.home-random__pip--bottom-left {
  grid-area: 3 / 1;
}

.home-random__pip--bottom-right {
  grid-area: 3 / 3;
}

.home-random__dice[data-face="1"] .home-random__pip--center,
.home-random__dice[data-face="2"] .home-random__pip--top-left,
.home-random__dice[data-face="2"] .home-random__pip--bottom-right,
.home-random__dice[data-face="3"] .home-random__pip--top-left,
.home-random__dice[data-face="3"] .home-random__pip--center,
.home-random__dice[data-face="3"] .home-random__pip--bottom-right,
.home-random__dice[data-face="4"] .home-random__pip--top-left,
.home-random__dice[data-face="4"] .home-random__pip--top-right,
.home-random__dice[data-face="4"] .home-random__pip--bottom-left,
.home-random__dice[data-face="4"] .home-random__pip--bottom-right,
.home-random__dice[data-face="5"] .home-random__pip--top-left,
.home-random__dice[data-face="5"] .home-random__pip--top-right,
.home-random__dice[data-face="5"] .home-random__pip--center,
.home-random__dice[data-face="5"] .home-random__pip--bottom-left,
.home-random__dice[data-face="5"] .home-random__pip--bottom-right,
.home-random__dice[data-face="6"] .home-random__pip--top-left,
.home-random__dice[data-face="6"] .home-random__pip--top-right,
.home-random__dice[data-face="6"] .home-random__pip--mid-left,
.home-random__dice[data-face="6"] .home-random__pip--mid-right,
.home-random__dice[data-face="6"] .home-random__pip--bottom-left,
.home-random__dice[data-face="6"] .home-random__pip--bottom-right {
  opacity: 1;
}

.home-random__trigger.is-rolling .home-random__dice {
  animation: home-random-dice-wobble 520ms ease-in-out;
}

.home-random__panel {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.9rem;
  padding: 1.35rem 1.6rem;
  border-radius: 26px;
  background: color-mix(in srgb, var(--color-accent-bright) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 48%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 12px 28px rgba(0, 0, 0, 0.22);
  transition: background 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
  position: relative;
  overflow: hidden;
  min-height: clamp(190px, 21vw, 240px);
}

.home-random__panel--active {
  background: color-mix(in srgb, var(--color-surface-overlay) 94%, transparent);
  border-color: color-mix(in srgb, var(--color-accent-shadow) 40%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 12px 28px rgba(0, 0, 0, 0.2);
}

.home-random__prompt {
  margin: 0;
  font-size: clamp(1.05rem, 0.6vw + 0.85rem, 1.25rem);
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-contrast) 90%, var(--color-tone-muted) 10%);
  text-align: center;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-surface-overlay) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}


.home-random__card {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 62px;
  height: 62px;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  transition: transform 180ms ease;
  padding: 1.15rem 1.25rem;
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-surface-overlay) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 36%, transparent);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.02),
    0 10px 22px rgba(0, 0, 0, 0.18);
  text-decoration: none;
  color: var(--color-tone-contrast);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  width: 100%;
  min-height: clamp(190px, 21vw, 240px);
}

.home-random-card:hover,
.home-random-card:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-accent-bright) 45%, transparent);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.05),
    0 12px 26px rgba(0, 0, 0, 0.22);
  outline: none;
}

.home-random-card--placeholder {
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 0.85rem;
  pointer-events: none;
}

.home-random-card--placeholder .home-random-card__title {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.home-random-card__placeholder-copy {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.3;
  color: color-mix(in srgb, var(--color-tone-muted) 55%, var(--color-tone-contrast) 45%);
}

.home-random-card__title {
  margin: 0;
  font-size: clamp(1.05rem, 0.8vw + 0.95rem, 1.35rem);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.home-random-card__meta {
  margin: 0;
  font-size: 0.86rem;
  color: color-mix(in srgb, var(--color-tone-muted) 70%, var(--color-tone-contrast) 30%);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.home-random-card__meta time {
  font-variant-numeric: tabular-nums;
}

.home-random-card__meta-label {
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--color-tone-muted) 72%, var(--color-accent-shadow-light) 28%);
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.home-random-card__snippet {
  margin: 0;
  color: color-mix(in srgb, var(--color-tone-contrast) 85%, var(--color-tone-muted) 15%);
  font-size: 0.92rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-random-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-random-card__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.home-random-card__tag-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 40%, transparent);
  background: color-mix(in srgb, var(--color-accent-shadow-light) 18%, transparent);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 68%, var(--color-tone-contrast) 32%);
  text-decoration: none;
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
}

.home-random-card__tag-link:hover,
.home-random-card__tag-link:focus-visible {
  border-color: color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  background: color-mix(in srgb, var(--color-accent-bright) 18%, transparent);
  transform: translateY(-1px);
  outline: none;
}

.home-random-card--enter {
  opacity: 0;
  transform: translateY(12px);
}

.home-random-card--entered {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 220ms ease, transform 220ms ease;
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
  width: 30px;
  height: 30px;
  display: inline-block;
  flex-shrink: 0;
  background-color: var(--color-accent-bright);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}

.home-link-card__icon--youtube {
  mask-image: url("/static/icons/youtube_icon.svg");
  -webkit-mask-image: url("/static/icons/youtube_icon.svg");
}

.home-link-card__icon--discord {
  mask-image: url("/static/icons/discord_icon.svg");
  -webkit-mask-image: url("/static/icons/discord_icon.svg");
}

.home-link-card__icon--reddit {
  mask-image: url("/static/icons/reddit-icon.svg");
  -webkit-mask-image: url("/static/icons/reddit-icon.svg");
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
  .home-recent__scroller {
    --home-recent-gutter: 0.5rem;
  }

  .home-card {
    padding: 1rem 1.1rem;
  }

  .home-random__frame {
    flex-direction: column;
    align-items: center;
  }

  .home-random__trigger {
    width: 82px;
    min-width: 82px;
  }

  .home-random__panel {
    width: 100%;
  }

  .home-random-card {
    min-height: 0;
  }
}

@keyframes home-random-dice-wobble {
  0% {
    transform: rotate(0deg) scale(1);
  }
  30% {
    transform: rotate(-18deg) scale(1.04);
  }
  60% {
    transform: rotate(14deg) scale(0.98);
  }
  100% {
    transform: rotate(0deg) scale(1);
  }
}
`

  HomepageFeatures.afterDOMLoaded = homepageScript

  return HomepageFeatures
}) satisfies QuartzComponentConstructor
