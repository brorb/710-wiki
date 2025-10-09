import { QuartzComponentConstructor } from "./types"
import style from "./styles/linksHeader.scss"
import themeColors from "../../theme.colors.json"

const palette = themeColors

const navLinks = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 3l9 6.5" />
        <path d="M19 10v10a1 1 0 0 1-1 1h-4v-5h-4v5H6a1 1 0 0 1-1-1V10" />
      </svg>
    ),
  },
  {
    href: "/Characters/",
    label: "Characters",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
        <path d="M12 14c-4.4 0-8 2-8 4v2h16v-2c0-2-3.6-4-8-4Z" />
      </svg>
    ),
  },
  {
    href: "/Concepts/",
    label: "Concepts",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h18" />
        <path d="M5 8h14" />
        <path d="M7 12h10" />
        <path d="M9 16h6" />
        <path d="M11 20h2" />
      </svg>
    ),
  },
  {
    href: "/Media/",
    label: "Media",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M21 17.5 17 13.5a1 1 0 0 0-1.4 0L12 17l-2.3-2.3a1 1 0 0 0-1.4 0L3 20" />
      </svg>
    ),
  },
  {
    href: "/Puzzles/",
    label: "Puzzles",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4a2 2 0 1 1 4 0h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1h-1.5a1.5 1.5 0 1 0 0 3H19a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-2a2 2 0 1 1-4 0H8a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1h1.5a1.5 1.5 0 1 0 0-3H7a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h2Z" />
      </svg>
    ),
  },
  {
    href: "/Discord/",
    label: "Discord",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M20.5 4.6a17.7 17.7 0 0 0-4.4-1.3l-.2.4c-.2.4-.4.8-.6 1.2a17.3 17.3 0 0 0-6.6 0 10 10 0 0 0-.6-1.2l-.2-.4a17.4 17.4 0 0 0-4.4 1.3C1.7 9.4 1 13.6 1.3 17.7c1.6 1.2 3.3 2 5.2 2.6a12 12 0 0 0 .9-1.7c-.5-.2-1-.5-1.4-.8.3-.2.6-.4.9-.6 1.3.6 2.6 1 4 1s2.7-.3 4-.9l.9.6c-.4.3-.8.6-1.3.8.2.6.5 1.2.9 1.7 1.9-.6 3.6-1.4 5.2-2.6.4-4.3-.2-8.5-2.9-13.1Zm-11.3 9.9c-1 0-1.8-.9-1.8-1.9s.8-1.9 1.8-1.9 1.8.9 1.8 1.9-.8 1.9-1.8 1.9Zm5.6 0c-1 0-1.8-.9-1.8-1.9s.8-1.9 1.8-1.9 1.8.9 1.8 1.9-.8 1.9-1.8 1.9Z" />
      </svg>
    ),
  },
  {
    href: "/YouTube/",
    label: "YouTube",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
        <polygon points="10 9 15 12 10 15 10 9" />
      </svg>
    ),
  },
 ] as const

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
          {navLinks.map(({ href, label, icon }) => (
            <a class="links-header-item" href={href} key={href}>
              <span class="links-header-icon" aria-hidden="true">
                {icon}
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
