import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import discordWidgetScript from "./scripts/discordWidget.inline"

type DiscordWidgetVariant = "sidebar" | "banner"

interface DiscordWidgetOptions {
  variant?: DiscordWidgetVariant
}

const WIDGET_SRC = "https://discord.com/widget?id=1389902002737250314&theme=dark"
const FILTER_ID = "discord-widget-redify"
const TOP_BAND_HOLD_STOP = 0.098
// Raise this value to push the tinted header deeper into the widget, lower it to shrink the band.
const TOP_BAND_TRANSITION_STOP = 0.271
const DEFAULT_WIDGET_HEIGHT = 500
const TOP_BAND_TARGET_PX = TOP_BAND_TRANSITION_STOP * DEFAULT_WIDGET_HEIGHT

let widgetInstanceCounter = 0

const buildTopBandGradientData = (holdStop: number, transitionStop: number) => {
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='1' height='1'>
  <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0' stop-color='white' stop-opacity='1'/>
    <stop offset='${holdStop}' stop-color='white' stop-opacity='1'/>
    <stop offset='${transitionStop}' stop-color='black' stop-opacity='0'/>
    <stop offset='1' stop-color='black' stop-opacity='0'/>
  </linearGradient>
  <rect width='1' height='1' fill='url(#g)'/>
</svg>`.trim()

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const buildFilterId = () => `${FILTER_ID}-${++widgetInstanceCounter}`

const FilterDefinition = ({
  filterId,
  gradientData,
}: {
  filterId: string
  gradientData: string
}) => (
  <svg class="discord-widget__filters" aria-hidden="true" focusable="false" width="0" height="0">
    {/* Color matrix tints saturated blues, blended back so only the header band is affected */}
    <filter
      id={filterId}
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
        href={gradientData}
        xlinkHref={gradientData}
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
    const filterId = buildFilterId()
    const initialGradient = buildTopBandGradientData(TOP_BAND_HOLD_STOP, TOP_BAND_TRANSITION_STOP)
    return (
      <div
        class={classNames(displayClass, "discord-widget", `discord-widget--${variant}`)}
        data-filter-id={filterId}
        data-top-band-hold-stop={String(TOP_BAND_HOLD_STOP)}
        data-top-band-transition-stop={String(TOP_BAND_TRANSITION_STOP)}
        data-top-band-target-px={String(TOP_BAND_TARGET_PX)}
      >
        <FilterDefinition filterId={filterId} gradientData={initialGradient} />
        <iframe
          class="discord-widget__iframe"
          src={WIDGET_SRC}
          title="710 Discord"
          loading="lazy"
          allowTransparency={true}
          frameBorder="0"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          style={{ filter: `url(#${filterId})` }}
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
  background-color: var(--color-panel-depth);
}

.discord-widget--banner {
  max-width: none;
  margin-top: 2rem;
}

.discord-widget--banner .discord-widget__iframe {
  --discord-widget-max-width: 100%;
  --discord-widget-height: 420px;
}

.discord-widget--sidebar {
  width: min(100%, var(--discord-widget-max-width, 350px));
  display: inline-flex;
}

.discord-widget--sidebar .discord-widget__iframe {
  width: 100%;
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

  DiscordWidget.afterDOMLoaded = discordWidgetScript

  return DiscordWidget
}) satisfies QuartzComponentConstructor<DiscordWidgetOptions>
