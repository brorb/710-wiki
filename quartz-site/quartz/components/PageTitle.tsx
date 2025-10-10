import { joinSegments, pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)
  const assetVersion = "20251010"
  const bannerPath = `${joinSegments(baseDir, "static/branding/banner.png")}?v=${assetVersion}`
  const logoPath = `${joinSegments(baseDir, "static/wiki_logo.png")}?v=${assetVersion}`
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a href={baseDir} class="page-title-link">
        <img class="logo-desktop" src={logoPath} alt={title} />
        <span class="banner-wrapper">
          <img class="banner-mobile" src={bannerPath} alt={title} />
        </span>
      </a>
    </h2>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
  width: 100%;
}
.page-title-link {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
}
.logo-desktop {
  display: block;
  max-width: 175px;
  width: 100%;
  height: auto;
}
.banner-wrapper {
  display: none;
  width: 100%;
  border-radius: 0;
  overflow: hidden;
}
.banner-mobile {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
@media screen and (max-width: 800px) {
  .logo-desktop {
    display: none;
  }

  .banner-wrapper {
    display: block;
    width: 100%;
    max-height: 7.5rem;
    aspect-ratio: 3 / 1;
    margin-inline: calc(-1 * clamp(0.75rem, 3vw, 2.5rem));
    width: calc(100% + 2 * clamp(0.75rem, 3vw, 2.5rem));
  }

  .banner-mobile {
    height: 100%;
  }
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
