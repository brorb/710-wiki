import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

type DiscordWidgetVariant = "sidebar" | "banner"

interface DiscordWidgetOptions {
  variant?: DiscordWidgetVariant
}

const WIDGET_SRC =
  "https://discord.com/widget?id=1389902002737250314&theme=dark"

export default ((options?: DiscordWidgetOptions) => {
  const variant: DiscordWidgetVariant = options?.variant ?? "sidebar"

  const DiscordWidget: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <div class={classNames(displayClass, "discord-widget", `discord-widget--${variant}`)}>
        <iframe
          src={WIDGET_SRC}
          width="350"
          height="500"
          loading="lazy"
          title="710 Discord"
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
    flex-shrink: 0;
}

.discord-widget iframe {
  width: 100%;
  max-width: 350px;
  height: 500px;
  border: none;
  border-radius: 12px;
  background: rgba(24, 25, 30, 0.95);
}

.discord-widget--sidebar {
  max-width: 350px;
  margin-top: 0;
}

.discord-widget--banner {
  max-width: none;
  margin-top: 2rem;
}

.discord-widget--banner iframe {
  max-width: none;
  height: 420px;
}

@media (max-width: 480px) {
  .discord-widget iframe {
    height: 420px;
  }

  .discord-widget--banner iframe {
    height: 360px;
  }
}
`

  return DiscordWidget
}) satisfies QuartzComponentConstructor<DiscordWidgetOptions>
