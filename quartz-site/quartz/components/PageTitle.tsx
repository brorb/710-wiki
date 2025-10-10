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
        <img class="Logo logo-desktop" src={logoPath} alt={title} />
        <img class="Logo banner-mobile" src={bannerPath} alt={title} />
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
  display: block;
  width: 100%;
}
.Logo {
  display: block;
  width: auto;
  height: auto;
  border-radius: 0;
  box-shadow: none;
}
.logo-desktop {
  max-width: 175px;
}
.banner-mobile {
  display: none;
  width: 100%;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
