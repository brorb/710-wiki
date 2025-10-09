import { QuartzComponentConstructor } from "./types"
import style from "./styles/linksHeader.scss"
import themeColors from "../../theme.colors.json"

const palette = themeColors

const iconPath = (slug: string) => `/static/icons/${slug}_icon.svg`

const navLinks: Array<{ href: string; label: string; iconSlug: string }> = [
  {
    href: "/",
    label: "Home",
    iconSlug: "home",
  },
  {
    href: "/News/",
    label: "News",
    iconSlug: "news",
  },
  {
    href: "/Characters/",
    label: "Characters",
    iconSlug: "characters",
  },
  {
    href: "/Concepts/",
    label: "Concepts",
    iconSlug: "concepts",
  },
  {
    href: "/Media/",
    label: "Media",
    iconSlug: "media",
  },
  {
    href: "/Puzzles/",
    label: "Puzzles",
    iconSlug: "puzzles",
  },
  {
    href: "/Discord/",
    label: "Discord",
    iconSlug: "discord",
  },
  {
    href: "/YouTube/",
    label: "YouTube",
    iconSlug: "youtube",
  },
]

export default (() => {
  const LinksHeader = () => {
    return (
      <div id="links-header-container">
        <nav
          id="links-header"
          style={{
            "--link-button-bg": palette.buttonBackground,
            "--link-button-border": palette.accentSecondary,
            "--link-button-hover": palette.buttonHover,
            "--link-button-text": palette.buttonText,
          } as Record<string, string>}
        >
          {navLinks.map(({ href, label, iconSlug }) => (
            <a class="links-header-item" href={href} key={href}>
              <span class="links-header-icon" aria-hidden="true">
                <img src={iconPath(iconSlug)} alt="" loading="lazy" decoding="async" />
              </span>
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <hr />
      </div>
    )
  }

  LinksHeader.css = style

  return LinksHeader
}) satisfies QuartzComponentConstructor
