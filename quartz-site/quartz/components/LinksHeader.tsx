import { QuartzComponentConstructor } from "./types"
import style from "./styles/linksHeader.scss"

const navLinks: Array<{ href: string; label: string; iconSlug: string; alignRight?: boolean }> = [
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
  {
    href: "/Contribute/",
    label: "Contribute",
    iconSlug: "contribute",
    alignRight: true,
  },
]

export default (() => {
  const LinksHeader = () => {
    return (
      <div id="links-header-container">
        <nav id="links-header">
          {navLinks.map(({ href, label, iconSlug, alignRight }) => {
            const classes = ["links-header-item", `links-header-item--${iconSlug}`]
            if (alignRight) {
              classes.push("links-header-item--right")
            }

            return (
              <a class={classes.join(" ")} href={href} key={href}>
                {iconSlug === "contribute" ? (
                  <span class="links-header-icon links-header-icon--image" aria-hidden="true">
                    <img src="/static/icons/plus-icon.svg" alt="" />
                  </span>
                ) : (
                  <span class={`links-header-icon links-header-icon--${iconSlug}`} aria-hidden="true" />
                )}
                <span>{label}</span>
              </a>
            )
          })}
        </nav>
      </div>
    )
  }

  LinksHeader.css = style

  return LinksHeader
}) satisfies QuartzComponentConstructor
