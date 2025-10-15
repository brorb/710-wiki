import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

type DiscordWidgetVariant = "sidebar" | "banner"

interface DiscordWidgetOptions {
  variant?: DiscordWidgetVariant
}

const WIDGET_SRC = "https://discord.com/widget?id=1389902002737250314&theme=dark"
const FILTER_ID = "discord-widget-redify"
const TOP_BAND_GRADIENT_DATA =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='1' height='1'%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='white' stop-opacity='1'/%3E%3Cstop offset='0.2' stop-color='white' stop-opacity='1'/%3E%3Cstop offset='0.27' stop-color='black' stop-opacity='0'/%3E%3Cstop offset='1' stop-color='black' stop-opacity='0'/%3E%3C/linearGradient%3E%3Crect width='1' height='1' fill='url(%23g)'/%3E%3C/svg%3E"

const FilterDefinition = () => (
  <svg class="discord-widget__filters" aria-hidden="true" focusable="false" width="0" height="0">
    {/* Color matrix tints saturated blues, blended back so only the header band is affected */}
    <filter
      id={FILTER_ID}
      color-interpolation-filters="sRGB"
      filterUnits="objectBoundingBox"
      primitiveUnits="objectBoundingBox"
      x="0"
      y="0"
      width="1"
      height="1"
    >
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0.6813 -0.3187 0.6373 0 0  0.2743 1.2743 -0.5486 0 0  0.8047 0.8047 -0.6094 0 0  0 0 0 1 0"
        result="tinted"
      />
      <feImage
        x="0"
        y="0"
        width="1"
        height="1"
        preserveAspectRatio="none"
  href={TOP_BAND_GRADIENT_DATA}
  xlinkHref={TOP_BAND_GRADIENT_DATA}
        result="topGradient"
      />
      <feColorMatrix
        in="topGradient"
        type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0"
        result="topMask"
      />
      <feComposite in="tinted" in2="topMask" operator="in" result="tintedTop" />
      <feComposite in="SourceGraphic" in2="topMask" operator="out" result="originalBottom" />
      <feMerge>
        <feMergeNode in="tintedTop" />
        <feMergeNode in="originalBottom" />
      </feMerge>
    </filter>
  </svg>
)

export default ((options?: DiscordWidgetOptions) => {
  const variant: DiscordWidgetVariant = options?.variant ?? "sidebar"

  const DiscordWidget: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <div class={classNames(displayClass, "discord-widget", `discord-widget--${variant}`)}>
        <FilterDefinition />
        <iframe
          class="discord-widget__iframe"
          src={WIDGET_SRC}
          title="710 Discord"
          loading="lazy"
          allowTransparency={true}
          frameBorder="0"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        ></iframe>
      </div>
    )
  }

  DiscordWidget.css = `
.discord-widget {
  width: 100%;
  display: flex;
  justify-content: center;
}
.discord-widget__filters {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.discord-widget__iframe {
  width: min(100%, var(--discord-widget-max-width, 350px));
  height: var(--discord-widget-height, 500px);
  border: none;
  border-radius: 12px;
  background-color: #040405;
  filter: url(#${FILTER_ID});
}

.discord-widget--banner {
  max-width: none;
  margin-top: 2rem;
}

.discord-widget--banner .discord-widget__iframe {
  --discord-widget-max-width: 100%;
  --discord-widget-height: 420px;
}

@media (max-width: 480px) {
  .discord-widget__iframe {
    --discord-widget-height: 420px;
  }

  .discord-widget--banner .discord-widget__iframe {
    --discord-widget-height: 360px;
  }
}
`

  return DiscordWidget
}) satisfies QuartzComponentConstructor<DiscordWidgetOptions>
