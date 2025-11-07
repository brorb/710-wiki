import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const OracleWidgetComponent: QuartzComponent = ({ cfg, fileData }: QuartzComponentProps) => {
  const oracleConfig = cfg.oracleChat

  if (!oracleConfig || oracleConfig.enabled === false) {
    return null
  }

  const articleTitle = fileData.frontmatter?.title ?? fileData.slug ?? ""
  const articleSlug = fileData.slug ?? ""

  const {
    apiBaseUrl = "",
    endpointPath = "/api/oracle/query",
    recaptchaSiteKey,
    storageKey = "oracle-chat-history",
    maxHistory = 24,
  } = oracleConfig

  const launcherLabelId = "oracle-widget-launcher-label"

  return (
    <div
      class="oracle-widget"
      data-oracle-api-base={apiBaseUrl || undefined}
      data-oracle-endpoint={endpointPath || undefined}
      data-oracle-storage-key={storageKey}
      data-oracle-max-history={String(maxHistory)}
      data-oracle-recaptcha-key={recaptchaSiteKey || undefined}
      data-oracle-article-title={articleTitle || undefined}
      data-oracle-article-slug={articleSlug || undefined}
    >
      <button
        type="button"
        class="oracle-widget__launcher"
        aria-haspopup="dialog"
        aria-controls="oracle-chat-panel"
        aria-expanded="false"
        aria-labelledby={launcherLabelId}
      >
        <span class="oracle-widget__copy" id={launcherLabelId}>
          <span class="oracle-widget__title">Ask ORA_CLE</span>
        </span>
        <span class="oracle-widget__avatar-wrap" aria-hidden="true">
          <img
            src="/static/oracle-pfp.png"
            alt=""
            class="oracle-widget__avatar"
            loading="lazy"
            decoding="async"
          />
        </span>
      </button>
      <div class="oracle-chat" id="oracle-chat-panel" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="oracle-chat__surface" role="document">
          <button
            type="button"
            class="oracle-chat__dismiss-tab"
            data-oracle-action="dismiss-tab"
            aria-label="Collapse chat panel"
          >
            <svg class="oracle-chat__dismiss-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M14.5 5.5a1 1 0 0 0-1.4 0l-6 6a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4-1.4L10.41 12l4.09-4.1a1 1 0 0 0 0-1.9z" />
            </svg>
          </button>
          <header class="oracle-chat__header">
            <div class="oracle-chat__identity">
              <img
                src="/static/oracle-pfp.png"
                alt=""
                class="oracle-chat__avatar"
                loading="lazy"
                decoding="async"
              />
              <div class="oracle-chat__identity-text">
                <span class="oracle-chat__name">The ORA_CLE</span>
                <span class="oracle-chat__status" data-oracle-status-text data-state="online">Bot status: Online</span>
              </div>
            </div>
            <div class="oracle-chat__header-actions">
              <button
                type="button"
                class="oracle-chat__reset"
                data-oracle-action="reset"
                aria-label="Reset conversation"
              >
                <span class="oracle-chat__reset-icon" aria-hidden="true"></span>
              </button>
              <button
                type="button"
                class="oracle-chat__close"
                aria-label="Close chat"
                data-oracle-action="close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </header>
          <section class="oracle-chat__history" data-oracle-history aria-live="polite" aria-label="Conversation history"></section>
          <form class="oracle-chat__composer" data-oracle-form>
            <div class="oracle-chat__input-row">
              <textarea
                id="oracle-chat-input"
                class="oracle-chat__input"
                name="oracle-chat-input"
                placeholder="Ask ORA_CLE anything about 7/10..."
                data-oracle-input
                rows={1}
                autoComplete="off"
                autoCapitalize="sentences"
                aria-label="Ask ORA_CLE anything about 7/10"
                spellcheck={true}
              ></textarea>
              <button type="submit" class="oracle-chat__send" data-oracle-send disabled>
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const oracleWidgetStyles = `
.oracle-widget {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  flex: 0 0 auto;
}

.oracle-widget__launcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1.5px solid color-mix(in srgb, var(--color-accent-bright) 75%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-accent-bright) 25%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 55%, transparent) 100%
  );
  color: var(--color-primary-background);
  border-radius: 999px;
  padding: 0.22rem 0.55rem 0.22rem 1.1rem;
  min-height: 2.45rem;
  cursor: pointer;
  transition: background 160ms ease, transform 120ms ease, box-shadow 160ms ease, border-color 160ms ease;
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow:
    inset 0 2px 6px rgba(255, 115, 125, 0.35),
    inset 0 -2px 6px rgba(107, 0, 4, 0.4),
    0 0 12px rgba(235, 28, 36, 0.4);
}

.oracle-widget__launcher:hover,
.oracle-widget__launcher:focus-visible {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-accent-bright) 35%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 70%, transparent) 100%
  );
  border-color: color-mix(in srgb, var(--color-accent-bright) 85%, transparent);
  box-shadow:
    inset 0 2px 8px rgba(255, 140, 150, 0.45),
    inset 0 -2px 8px rgba(107, 0, 4, 0.5),
    0 0 18px rgba(235, 28, 36, 0.55);
}

.oracle-widget__launcher:active {
  transform: translateY(1px);
}

.oracle-widget__launcher:focus-visible {
  outline: 2px solid var(--color-accent-deep);
  outline-offset: 2px;
}

.oracle-widget__avatar-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  overflow: hidden;
  margin-left: 0.35rem;
  margin-right: -0.25rem;
  flex: 0 0 auto;
}

.oracle-widget__avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  flex-shrink: 0;
}

.oracle-widget__copy {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  line-height: 1.1;
  font-size: 1.24rem;
  white-space: nowrap;
  color: var(--color-tone-primary);
}

.oracle-widget__title {
  font-weight: 700;
  letter-spacing: 0.08em;
  font-family: "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace;
  color: var(--color-tone-primary);
  font-size: 1.05em;
}

.oracle-chat {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(500px, 100vw);
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: translateX(100%);
  z-index: 1600;
}

.oracle-chat.oracle-chat--open,
.oracle-chat.oracle-chat--closing {
  visibility: visible;
}

.oracle-chat.oracle-chat--open {
  pointer-events: auto;
  transform: translateX(0);
  opacity: 1;
}

.oracle-chat.oracle-chat--open.oracle-chat--entering {
  animation: oracle-chat-slide-in 260ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

.oracle-chat.oracle-chat--closing {
  pointer-events: none;
  animation: oracle-chat-slide-out 220ms cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.oracle-chat__surface {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--color-primary-background);
  border-left: 1px solid color-mix(in srgb, var(--color-accent-shadow) 45%, transparent);
  box-shadow: -26px 0 56px rgba(0, 0, 0, 0.38);
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.oracle-chat__dismiss-tab {
  position: absolute;
  top: 50%;
  left: -1px;
  transform: translate(calc(-100% - 0.85rem), -50%);
  width: 2.75rem;
  height: 5.4rem;
  z-index: 1;
  border: 1px solid color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  border-right: none;
  border-radius: 14px 0 0 14px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-accent-bright) 70%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 65%, transparent) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-button-text);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease, transform 200ms ease, background 160ms ease, border-color 160ms ease;
  box-shadow:
    -6px 0 18px rgba(0, 0, 0, 0.45),
    inset 0 1px 6px rgba(255, 170, 170, 0.25);
}

.oracle-chat__dismiss-tab:hover,
.oracle-chat__dismiss-tab:focus-visible {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-accent-bright) 82%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-deep) 75%, transparent) 100%
  );
  border-color: color-mix(in srgb, var(--color-accent-bright) 85%, transparent);
}

.oracle-chat__dismiss-tab:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.oracle-chat.oracle-chat--open .oracle-chat__dismiss-tab {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-100%, -50%);
}

.oracle-chat__dismiss-icon {
  width: 1.4rem;
  height: 1.4rem;
  fill: currentColor;
  transform: scaleX(-1);
}

.oracle-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.35rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-accent-shadow) 30%, transparent);
}

.oracle-chat__identity {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.oracle-chat__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.oracle-chat__identity-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.oracle-chat__name {
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-tone-contrast);
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
}

.oracle-chat__status {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  font-family: var(--font-oracle-label, "VCR OSD Mono", var(--font-thematic), "Share Tech Mono", "Lucida Console", "Courier New", monospace);
  color: var(--color-tone-muted);
  transition: color 160ms ease;
}

.oracle-chat__status[data-state="online"] {
  color: var(--color-accent-bright);
}

.oracle-chat__status[data-state="offline"] {
  color: var(--color-feedback-error);
}

.oracle-chat__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.oracle-chat__reset {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-accent-bright) 45%, transparent);
  background: color-mix(in srgb, var(--color-accent-bright) 18%, transparent);
  color: var(--color-accent-bright);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease, border-color 160ms ease;
}

.oracle-chat__reset:hover,
.oracle-chat__reset:focus-visible {
  background: color-mix(in srgb, var(--color-accent-bright) 32%, transparent);
  color: var(--color-primary-background);
  border-color: color-mix(in srgb, var(--color-accent-bright) 70%, transparent);
}

.oracle-chat__reset:focus-visible {
  outline: 2px solid var(--color-accent-deep);
  outline-offset: 2px;
}

.oracle-chat__reset:active {
  transform: translateY(1px);
}

.oracle-chat__reset-icon {
  width: 1.2rem;
  height: 1.2rem;
  display: block;
  mask: url("/static/icons/refresh-icon.svg") no-repeat center / contain;
  background: currentColor;
}

.oracle-chat__reset:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
  background: color-mix(in srgb, var(--color-accent-bright) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-accent-bright) 22%, transparent);
  color: color-mix(in srgb, var(--color-accent-bright) 65%, var(--color-tone-muted) 35%);
}

.oracle-chat__close {
  border: none;
  background: color-mix(in srgb, var(--color-accent-shadow) 30%, transparent);
  color: var(--color-tone-contrast);
  font-size: 1.25rem;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.oracle-chat__close:hover,
.oracle-chat__close:focus-visible {
  background: color-mix(in srgb, var(--color-accent-bright) 35%, transparent);
}

.oracle-chat__history {
  flex: 1 1 auto;
  padding: 1.1rem 1.35rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-behavior: smooth;
}

.oracle-chat__history:empty::before {
  content: "Ask a question to start your conversation with the ORA_CLE.";
  color: var(--color-tone-muted);
  font-size: 0.9rem;
}

.oracle-chat__message {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.oracle-chat__message--user {
  align-items: flex-end;
}

.oracle-chat__bubble {
  max-width: 85%;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-accent-shadow-light) 45%, transparent);
  color: var(--color-tone-contrast);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  white-space: normal;
  word-break: break-word;
}

.oracle-chat__message--user .oracle-chat__bubble {
  background: color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  color: var(--color-primary-background);
  display: block;
  white-space: pre-wrap;
}

.oracle-chat__message--assistant .oracle-chat__bubble {
  background: color-mix(in srgb, var(--color-accent-shadow) 18%, transparent);
}

.oracle-chat__bubble--pending {
  gap: 0.4rem;
  color: color-mix(in srgb, var(--color-tone-muted) 82%, var(--color-tone-contrast) 18%);
  font-style: italic;
}

.oracle-chat__pending-text {
  margin: 0;
  font-size: 0.85rem;
}

.oracle-chat__pending-context {
  margin: 0;
  font-size: 0.8rem;
  color: color-mix(in srgb, var(--color-tone-muted) 75%, var(--color-tone-contrast) 25%);
}

.oracle-chat__pending-context-item {
  font-style: italic;
  color: var(--color-accent-bright);
}

.oracle-chat__message--error .oracle-chat__bubble {
  background: color-mix(in srgb, var(--color-feedback-error) 35%, transparent);
  color: var(--color-tone-contrast);
}

.oracle-chat__answer-lead {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.5;
}

.oracle-chat__answer-body {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: color-mix(in srgb, var(--color-tone-contrast) 92%, var(--color-tone-muted) 8%);
}

.oracle-chat__rich-text a {
  color: var(--color-accent-bright);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.oracle-chat__rich-text a:hover,
.oracle-chat__rich-text a:focus-visible {
  color: color-mix(in srgb, var(--color-accent-bright) 85%, var(--color-tone-contrast) 15%);
}

.oracle-chat__link-rail {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.oracle-chat__link-rail-label {
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 70%, var(--color-tone-contrast) 30%);
}

.oracle-chat__link-rail-items {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.oracle-chat__link-rail-items::-webkit-scrollbar {
  height: 6px;
}

.oracle-chat__link-rail-items::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-accent-shadow) 35%, transparent);
  border-radius: 999px;
}

.oracle-chat__pill-link {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  gap: 0.35rem;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-accent-bright);
  background: color-mix(in srgb, var(--color-accent-bright) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  text-decoration: none;
  scroll-snap-align: start;
}

.oracle-chat__pill-link:hover,
.oracle-chat__pill-link:focus-visible {
  background: color-mix(in srgb, var(--color-accent-bright) 30%, transparent);
  color: var(--color-primary-background);
}

.oracle-chat__pill-link--static {
  cursor: default;
  color: color-mix(in srgb, var(--color-tone-contrast) 85%, var(--color-tone-muted) 15%);
  background: color-mix(in srgb, var(--color-tone-muted) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-tone-muted) 32%, transparent);
}

.oracle-chat__cta {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  font-weight: 600;
  color: color-mix(in srgb, var(--color-accent-bright) 75%, var(--color-tone-contrast) 25%);
}

.oracle-chat__followups {
  display: grid;
  gap: 0.45rem;
}

.oracle-chat__followups-label {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-tone-muted) 70%, var(--color-tone-contrast) 30%);
}

.oracle-chat__followup-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.oracle-chat__followup-button {
  border: 1px solid color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
  background: color-mix(in srgb, var(--color-accent-bright) 18%, transparent);
  color: var(--color-accent-bright);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, transform 140ms ease;
}

.oracle-chat__followup-button:hover,
.oracle-chat__followup-button:focus-visible {
  background: color-mix(in srgb, var(--color-accent-bright) 35%, transparent);
  color: var(--color-primary-background);
}

.oracle-chat__followup-button:active {
  transform: translateY(1px);
}

.oracle-chat__fallback {
  display: grid;
  gap: 0.45rem;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--color-tone-muted) 45%, transparent);
  padding: 0.65rem 0.75rem;
  background: color-mix(in srgb, var(--color-tone-muted) 12%, transparent);
}

.oracle-chat__fallback-text {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: color-mix(in srgb, var(--color-tone-contrast) 90%, var(--color-tone-muted) 10%);
}

.oracle-chat__fallback-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.oracle-chat__fallback-button {
  border: 1px solid color-mix(in srgb, var(--color-tone-muted) 55%, transparent);
  background: color-mix(in srgb, var(--color-tone-muted) 28%, transparent);
  color: color-mix(in srgb, var(--color-tone-contrast) 88%, var(--color-tone-muted) 12%);
  border-radius: 8px;
  padding: 0.3rem 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.oracle-chat__fallback-button:hover,
.oracle-chat__fallback-button:focus-visible {
  background: color-mix(in srgb, var(--color-tone-muted) 12%, var(--color-tone-contrast) 20%);
  color: var(--color-primary-background);
}

.oracle-chat__disclaimers {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--color-tone-muted) 82%, var(--color-tone-contrast) 18%);
  display: grid;
  gap: 0.3rem;
}

.oracle-chat__disclaimer-item {
  line-height: 1.4;
}

.oracle-chat__timestamp {
  font-size: 0.7rem;
  color: var(--color-tone-muted);
}

.oracle-chat__composer {
  border-top: 1px solid color-mix(in srgb, var(--color-accent-shadow) 24%, transparent);
  padding: 0.9rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.oracle-chat__input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.55rem;
}

.oracle-chat__input {
  flex: 1 1 auto;
  resize: none;
  border: 1px solid color-mix(in srgb, var(--color-accent-shadow) 25%, transparent);
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  min-height: 2.35rem;
  max-height: 8.5rem;
  background: var(--color-primary-background);
  color: var(--color-tone-contrast);
}

.oracle-chat__input:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.oracle-chat__send {
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  padding: 0.65rem 1.2rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--color-accent-bright);
  color: var(--color-primary-background);
  transition: opacity 140ms ease, transform 140ms ease;
}

.oracle-chat__send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.oracle-chat__send:not(:disabled):active {
  transform: translateY(1px);
}

.oracle-chat__message--pending .oracle-chat__bubble::after {
  content: "…";
  margin-left: 0.35rem;
  animation: oracle-chat-typing 1.2s infinite;
}

@keyframes oracle-chat-slide-in {
  0% {
    transform: translateX(100%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes oracle-chat-slide-out {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes oracle-chat-typing {
  0% {
    opacity: 0.2;
  }
  33% {
    opacity: 1;
  }
  66% {
    opacity: 0.2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .oracle-chat {
    transition: none;
  }

  .oracle-chat.oracle-chat--open,
  .oracle-chat.oracle-chat--closing {
    animation: none !important;
  }

  .oracle-chat.oracle-chat--closing {
    transform: translateX(100%);
    opacity: 0;
  }
}

@media (max-width: 720px) {
  .oracle-widget {
    width: 100%;
  }

  .oracle-widget__launcher {
    width: 100%;
    justify-content: space-between;
    padding-right: 1rem;
  }

  .oracle-chat__surface {
    width: 100%;
    height: 100%;
    max-height: none;
    border-radius: 0;
  }
}
`

OracleWidgetComponent.css = oracleWidgetStyles

export const ORACLE_WIDGET_STYLES = oracleWidgetStyles

// @ts-ignore - inline script loader provides this
import oracleChatScript from "./scripts/oracleChat.inline"

// @ts-ignore
// @ts-ignore
OracleWidgetComponent.afterDOMLoaded = oracleChatScript

export const ORACLE_WIDGET_SCRIPT = oracleChatScript

export const OracleWidget = OracleWidgetComponent

export default (() => OracleWidgetComponent) satisfies QuartzComponentConstructor
