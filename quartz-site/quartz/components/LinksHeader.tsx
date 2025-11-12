import { QuartzComponentConstructor } from "./types"
import style from "./styles/linksHeader.scss"

const navLinks: Array<{ href: string; label: string; iconSlug: string }> = [
  {
    href: "/",
    label: "Home",
    iconSlug: "home",
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
    href: "/Discord/",
    label: "Discord",
    iconSlug: "discord",
  },
  {
    href: "/YouTube/",
    label: "YouTube",
    iconSlug: "youtube",
  },
  {
    href: "/Explorables/",
    label: "Explorables",
    iconSlug: "explorables",
  },
]

export default (() => {
  const LinksHeader = () => {
    return (
      <div id="links-header-container">
        <nav id="links-header">
          {navLinks.map(({ href, label, iconSlug }) => (
            <a class="links-header-item" href={href} key={href}>
              <span class={`links-header-icon links-header-icon--${iconSlug}`} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </div>
    )
  }

  LinksHeader.css = style

  return LinksHeader
}) satisfies QuartzComponentConstructor
