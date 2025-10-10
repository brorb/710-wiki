import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { joinSegments, pathToRoot } from "../util/path"
import { getAssetVersion } from "../util/assetVersion"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)
  const assetVersion = `?v=${getAssetVersion()}`
  const logoPath = `${joinSegments(baseDir, "static/wiki_logo.png")}${assetVersion}`
  const bannerPath = `${joinSegments(baseDir, "static/branding/banner.png")}${assetVersion}`

  return (
    <div class={classNames(displayClass, "page-title-container")}>
      <a class="page-title-link" href={baseDir} aria-label={title}>
        <img class="logo-desktop" src={logoPath} alt={title} loading="lazy" decoding="async" />
        <span class="banner-wrapper">
          <img class="banner-mobile" src={bannerPath} alt={title} loading="lazy" decoding="async" />
        </span>
      </a>
    </div>
  )
}

PageTitle.css = `
.page-title-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.page-title-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-decoration: none;
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
  max-height: 7.5rem;
  aspect-ratio: 3 / 1;
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
  .page-title-container {
    margin-inline: calc(-1 * clamp(0.75rem, 3vw, 2.5rem));
    width: calc(100% + 2 * clamp(0.75rem, 3vw, 2.5rem));
  }

  .logo-desktop {
    display: none;
  }

  .banner-wrapper {
    display: block;
  }

  .banner-mobile {
    height: 100%;
  }
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
