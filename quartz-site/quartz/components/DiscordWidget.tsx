import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import discordWidgetScript from "./scripts/discordWidget.inline"

type DiscordWidgetVariant = "sidebar" | "banner"

interface DiscordWidgetOptions {
  variant?: DiscordWidgetVariant
}

const WIDGET_SRC = "https://discord.com/widget?id=1389902002737250314&theme=dark"
const DISCORD_INVITE = "https://discord.com/invite/sleuth707"
const MASK_HEIGHT_PX = 78

export default ((options?: DiscordWidgetOptions) => {
  const variant: DiscordWidgetVariant = options?.variant ?? "sidebar"

  const DiscordWidget: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <div class={classNames(displayClass, "discord-widget", `discord-widget--${variant}`)}>
        <div class="discord-widget__frame">
          <div class="discord-widget__header">
            <div class="discord-widget__brand">
              <span class="discord-widget__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path
                    d="M20.317 4.369A18.171 18.171 0 0 0 16.268 3a12.673 12.673 0 0 0-.614 1.265 16.532 16.532 0 0 0-4.308 0A11.723 11.723 0 0 0 10.731 3a18.274 18.274 0 0 0-4.052 1.38c-2.569 3.773-3.652 7.456-3.266 11.092a18.411 18.411 0 0 0 4.979 2.546 13.42 13.42 0 0 0 1.07-1.71 11.832 11.832 0 0 1-1.688-.812c.142-.102.281-.205.417-.312a13.116 13.116 0 0 0 11.034 0c.136.107.275.21.417.312a11.77 11.77 0 0 1-1.7.82c.314.6.672 1.168 1.07 1.71a18.316 18.316 0 0 0 4.99-2.558c.409-3.983-.67-7.64-3.317-11.09ZM8.68 14.153c-.965 0-1.753-.915-1.753-2.038s.767-2.038 1.753-2.038 1.765.926 1.753 2.038c0 1.123-.767 2.038-1.753 2.038Zm6.64 0c-.965 0-1.753-.915-1.753-2.038s.767-2.038 1.753-2.038 1.765.926 1.753 2.038c0 1.123-.788 2.038-1.753 2.038Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <div class="discord-widget__text">
                <span class="discord-widget__title">Discord</span>
                <span class="discord-widget__online">
                  <span
                    class="discord-widget__online-count"
                    data-discord-member-count
                    aria-live="polite"
                    aria-label="Loading Discord member count"
                  >
                    —
                  </span>
                  <span class="discord-widget__online-label">Members Online</span>
                </span>
              </div>
            </div>
            <a class="discord-widget__cta" href={DISCORD_INVITE} target="_blank" rel="noopener">
              Join
            </a>
          </div>
          <div class="discord-widget__embed">
            <iframe
              src={WIDGET_SRC}
              title="710 Discord"
              loading="lazy"
              allowTransparency={true}
              frameBorder="0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              width="100%"
              height="100%"
            ></iframe>
            <div class="discord-widget__mask" aria-hidden="true"></div>
          </div>
        </div>
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

.discord-widget__frame {
  position: relative;
  width: min(100%, var(--discord-frame-max-width, 350px));
  border-radius: 12px;
  overflow: hidden;
  background: rgba(24, 25, 30, 0.95);
  display: flex;
  flex-direction: column;
  --discord-embed-height: 500px;
  --discord-mask-height: ${MASK_HEIGHT_PX}px;
}

.discord-widget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  background: #b71002;
  color: #ffffff;
}

.discord-widget__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.discord-widget__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
}

.discord-widget__icon svg {
  width: 26px;
  height: 26px;
}

.discord-widget__text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.discord-widget__title {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.discord-widget__online {
  display: inline-flex;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
  align-items: baseline;
}

.discord-widget__online-count {
  font-variant-numeric: tabular-nums;
}

.discord-widget__online-label {
  opacity: 0.85;
}

.discord-widget__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.35);
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.discord-widget__cta:hover,
.discord-widget__cta:focus-visible {
  background: rgba(0, 0, 0, 0.35);
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}

.discord-widget__embed {
  position: relative;
  width: 100%;
  height: var(--discord-embed-height);
  overflow: hidden;
}

.discord-widget__embed iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background-color: #040405;
}

.discord-widget__mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--discord-mask-height);
  background: #b71002;
  pointer-events: none;
  z-index: 2;
  box-shadow: 0 6px 16px -12px rgba(0, 0, 0, 0.65);
}

.discord-widget--sidebar {
  max-width: 350px;
  margin-top: 0;
}

.discord-widget--banner {
  max-width: none;
  margin-top: 2rem;
}

.discord-widget--banner .discord-widget__frame {
  --discord-frame-max-width: 100%;
  --discord-embed-height: 420px;
}

@media (max-width: 480px) {
  .discord-widget__frame {
    --discord-embed-height: 460px;
  }

  .discord-widget--banner .discord-widget__frame {
    --discord-embed-height: 360px;
  }
}
`

  DiscordWidget.afterDOMLoaded = discordWidgetScript

  return DiscordWidget
}) satisfies QuartzComponentConstructor<DiscordWidgetOptions>
