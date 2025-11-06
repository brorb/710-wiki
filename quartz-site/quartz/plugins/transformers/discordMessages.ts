import { QuartzTransformerPlugin } from "../types"
import { getAssetVersion } from "../../util/assetVersion"
import { FilePath, FullSlug, joinSegments, pathToRoot, slugifyFilePath } from "../../util/path"
import { findAssetByBasename } from "../../util/assetLookup"

interface DiscordAuthor {
  id?: string
  display_name?: string
  username?: string
  color?: string
  colour?: string
  colour_value?: number | string
}

type DiscordAttachmentType = "image" | "audio" | "video" | "file"

interface DiscordAttachment {
  type: DiscordAttachmentType
  src: string
  alt?: string
  title?: string
}

type DiscordAttachmentValue =
  | string
  | {
      src?: string
      attachment?: string
      target?: string
      url?: string
      alt?: string
      type?: string
      mtype?: string
    }

type DiscordImageValue = DiscordAttachmentValue

interface DiscordMessage {
  url?: string
  jump_url?: string
  id?: string
  content?: string
  timestamp?: string
  avatar_url?: string
  author?: DiscordAuthor
  attachments?: DiscordAttachment[] | DiscordAttachmentValue | DiscordAttachmentValue[]
  attachment?: DiscordAttachmentValue | DiscordAttachmentValue[]
  image?: DiscordImageValue | DiscordImageValue[]
  images?: DiscordImageValue | DiscordImageValue[]
  image_alt?: string
  imageAlt?: string
}

const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"

const DISCORD_CITE_ICON_PATH =
  "M20.992 20.163c-1.511-0.099-2.699-1.349-2.699-2.877 0-0.051 0.001-0.102 0.004-0.153l-0 0.007c-0.003-0.048-0.005-0.104-0.005-0.161 0-1.525 1.19-2.771 2.692-2.862l0.008-0c1.509 0.082 2.701 1.325 2.701 2.847 0 0.062-0.002 0.123-0.006 0.184l0-0.008c0.003 0.050 0.005 0.109 0.005 0.168 0 1.523-1.191 2.768-2.693 2.854l-0.008 0zM11.026 20.163c-1.511-0.099-2.699-1.349-2.699-2.877 0-0.051 0.001-0.102 0.004-0.153l-0 0.007c-0.003-0.048-0.005-0.104-0.005-0.161 0-1.525 1.19-2.771 2.692-2.862l0.008-0c1.509 0.082 2.701 1.325 2.701 2.847 0 0.062-0.002 0.123-0.006 0.184l0-0.008c0.003 0.048 0.005 0.104 0.005 0.161 0 1.525-1.19 2.771-2.692 2.862l-0.008 0zM26.393 6.465c-1.763-0.832-3.811-1.49-5.955-1.871l-0.149-0.022c-0.005-0.001-0.011-0.002-0.017-0.002-0.035 0-0.065 0.019-0.081 0.047l-0 0c-0.234 0.411-0.488 0.924-0.717 1.45l-0.043 0.111c-1.030-0.165-2.218-0.259-3.428-0.259s-2.398 0.094-3.557 0.275l0.129-0.017c-0.27-0.63-0.528-1.142-0.813-1.638l0.041 0.077c-0.017-0.029-0.048-0.047-0.083-0.047-0.005 0-0.011 0-0.016 0.001l0.001-0c-2.293 0.403-4.342 1.060-6.256 1.957l0.151-0.064c-0.017 0.007-0.031 0.019-0.040 0.034l-0 0c-2.854 4.041-4.562 9.069-4.562 14.496 0 0.907 0.048 1.802 0.141 2.684l-0.009-0.11c0.003 0.029 0.018 0.053 0.039 0.070l0 0c2.14 1.601 4.628 2.891 7.313 3.738l0.176 0.048c0.008 0.003 0.018 0.004 0.028 0.004 0.032 0 0.060-0.015 0.077-0.038l0-0c0.535-0.72 1.044-1.536 1.485-2.392l0.047-0.1c0.006-0.012 0.010-0.027 0.010-0.043 0-0.041-0.026-0.075-0.062-0.089l-0.001-0c-0.912-0.352-1.683-0.727-2.417-1.157l0.077 0.042c-0.029-0.017-0.048-0.048-0.048-0.083 0-0.031 0.015-0.059 0.038-0.076l0-0c0.157-0.118 0.315-0.24 0.465-0.364 0.016-0.013 0.037-0.021 0.059-0.021 0.014 0 0.027 0.003 0.038 0.008l-0.001-0c2.208 1.061 4.8 1.681 7.536 1.681s5.329-0.62 7.643-1.727l-0.107 0.046c0.012-0.006 0.025-0.009 0.040-0.009 0.022 0 0.043 0.008 0.059 0.021l-0-0c0.15 0.124 0.307 0.248 0.466 0.365 0.023 0.018 0.038 0.046 0.038 0.077 0 0.035-0.019 0.065-0.046 0.082l-0 0c-0.661 0.395-1.432 0.769-2.235 1.078l-0.105 0.036c-0.036 0.014-0.062 0.049-0.062 0.089 0 0.016 0.004 0.031 0.011 0.044l-0-0.001c0.501 0.96 1.009 1.775 1.571 2.548l-0.040-0.057c0.017 0.024 0.046 0.040 0.077 0.040 0.010 0 0.020-0.002 0.029-0.004l-0.001 0c2.865-0.892 5.358-2.182 7.566-3.832l-0.065 0.047c0.022-0.016 0.036-0.041 0.039-0.069l0-0c0.087-0.784 0.136-1.694 0.136-2.615 0-5.415-1.712-10.43-4.623-14.534l0.052 0.078c-0.008-0.016-0.022-0.029-0.038-0.036l-0-0z"

const SHARE_ICON_MASK_URL = "/static/icons/share_icon.svg"
const AUDIO_ICON_URL = "/static/icons/audio-icon.svg"
const VIDEO_ICON_URL = "/static/icons/video-icon.svg"
const FILE_ICON_URL = "/static/icons/file-icon.svg"
let discordThreadSequence = 0

const DISCORD_CSS = `
.discord-thread {
  --discord-bg: #2b2d31;
  --discord-border: #1f2024;
  --discord-hover: rgba(78, 80, 88, 0.6);
  --discord-text-primary: #f2f3f5;
  --discord-text-muted: #b5bac1;
  --discord-author: #f2f3f5;
  --discord-accent: #5865f2;
  background: var(--discord-bg);
  border: 1px solid var(--discord-border);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: min(720px, 100%);
  font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  position: relative;
}

.discord-thread-wrapper {
  position: relative;
  max-width: min(720px, 100%);
  display: block;
}

.discord-thread-content {
  position: relative;
  overflow: hidden;
  display: block;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.discord-thread-content.collapsed {
  max-height: 420px;
}

.discord-thread-fade {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 120px;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    to bottom,
    rgba(43, 45, 49, 0) 0%,
    rgba(43, 45, 49, 0.72) 52%,
    color-mix(in srgb, rgba(43, 45, 49, 0.9) 30%, var(--color-primary-background) 70%) 78%,
    var(--color-primary-background) 100%
  );
  transition: opacity 0.28s ease;
  z-index: 2;
}

.discord-thread-wrapper.collapsed .discord-thread-fade,
.discord-thread-content.collapsed .discord-thread-fade {
  opacity: 1;
}

.discord-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  margin: 0 auto;
  margin-top: -3rem;
  background: var(--color-surface-overlay);
  border: 1px solid var(--color-accent-deep);
  border-radius: 8px;
  color: var(--color-tone-contrast);
  font-family: var(--bodyFont);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  z-index: 3;
  width: fit-content;
  min-width: 140px;
}

.discord-thread-content:not(.collapsed) + .discord-collapse-toggle {
  margin-top: 0.75rem;
}

.discord-collapse-toggle:hover {
  background: var(--color-highlight-overlay);
  border-color: var(--color-accent-bright);
  color: var(--color-tone-contrast);
}

.discord-collapse-toggle:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.discord-collapse-icon {
  width: 16px;
  height: 16px;
  transform-origin: 50% 50%;
  transition: transform 0.3s ease;
}

.discord-collapse-toggle[aria-expanded="false"] .discord-collapse-icon {
  transform: rotate(0deg);
}

.discord-collapse-toggle[aria-expanded="true"] .discord-collapse-icon,
.discord-collapse-toggle.is-expanded .discord-collapse-icon {
  transform: rotate(180deg);
}

.discord-message {
  position: relative;
  border-radius: 8px;
  padding: 6px 8px 4px;
  color: var(--discord-text-primary);
  --discord-author-color: var(--discord-author);
  scroll-margin-top: 120px;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  text-decoration: none;
  align-items: flex-start;
  width: 100%;
  font: inherit;
  user-select: text;
  cursor: default;
  transition: background 0.18s ease;
}

.discord-message * {
  font-weight: inherit;
}

.discord-message[data-discord-jump] {
  cursor: pointer;
}

.discord-message[data-discord-jump]:focus-visible {
  outline: 2px solid var(--discord-accent);
  outline-offset: 2px;
}

.discord-message + .discord-message {
  margin-top: 2px;
}

.discord-message:hover {
  background: var(--discord-hover);
}

.discord-message--compact {
  padding-top: 2px;
}

.discord-avatar {
  width: 40px;
  min-width: 40px;
  height: 40px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  background: #1f2125;
  border: 1px solid rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
}

.discord-avatar-spacer {
  width: 40px;
  min-width: 40px;
  height: 10px;
  display: block;
  margin-top: 6px;
}

.discord-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}


.discord-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.discord-message--compact .discord-body {
  gap: 0.18rem;
}

.discord-header {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  column-gap: 0.5rem;
  row-gap: 0.15rem;
  line-height: 1.25;
  margin-bottom: 2px;
  min-width: 0;
}

.discord-author {
  font-weight: 600;
  color: var(--discord-author-color, var(--discord-author));
}

.discord-header time {
  font-size: 0.8125rem;
  color: var(--discord-text-muted);
  flex-shrink: 0;
  white-space: nowrap;
}

.discord-content {
  font-size: 0.95rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.discord-content--compact {
  margin-top: 2px;
}

.discord-attachments {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.discord-attachment {
  display: block;
  max-width: min(420px, 100%);
  border-radius: 10px;
  overflow: hidden;
  background: #1f2126;
  border: 1px solid rgba(0, 0, 0, 0.35);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.36);
}

.discord-attachment__card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.1rem;
  background: rgba(0, 0, 0, 0.22);
  color: var(--discord-text-primary);
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.18s ease, border-color 0.18s ease;
}

.discord-attachment__card:hover,
.discord-attachment__card:focus-visible {
  background: rgba(88, 101, 242, 0.16);
  border-color: rgba(88, 101, 242, 0.32);
  text-decoration: none;
  outline: none;
}

.discord-attachment__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(88, 101, 242, 0.2);
  color: #c7ccff;
  flex-shrink: 0;
}

.discord-attachment__icon img,
.discord-attachment__icon svg {
  width: 20px;
  height: 20px;
}

.discord-attachment__icon img {
  object-fit: contain;
  display: block;
}

.discord-attachment__card--audio .discord-attachment__icon img {
  filter: brightness(0) saturate(100%);
}

.discord-attachment__card--video .discord-attachment__icon {
  background: rgba(89, 54, 255, 0.24);
  color: #d7cbff;
}

.discord-attachment__card--file .discord-attachment__icon {
  background: rgba(79, 84, 92, 0.35);
  color: #d6dae3;
}

.discord-attachment__info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.discord-attachment__name {
  font-weight: 600;
  color: var(--discord-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discord-attachment__subtitle {
  font-size: 0.8rem;
  color: var(--discord-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discord-attachment__image-link {
  display: block;
  color: inherit;
}

.discord-attachment__image-link:hover,
.discord-attachment__image-link:focus-visible {
  opacity: 0.94;
  outline: none;
}

.discord-attachment img {
  display: block;
  width: 100%;
  height: auto;
}

.discord-attachment audio,
.discord-attachment video {
  display: block;
  width: 100%;
  max-width: 100%;
  outline: none;
}

.discord-attachment iframe {
  display: block;
  width: 100%;
  max-width: 100%;
  border: none;
  background: #000;
}

.discord-attachment video {
  max-height: 360px;
  background: #000;
}

.discord-attachment__control {
  margin: 0.65rem 1rem 1rem;
  border-radius: 10px;
  border: none;
  background: rgba(15, 17, 22, 0.85);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.discord-attachment__frame {
  margin: 0.65rem 1rem 1rem;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  background: rgba(15, 17, 22, 0.85);
  aspect-ratio: 16 / 9;
  min-height: 220px;
}

.discord-attachment__control::-webkit-media-controls-panel {
  background-color: rgba(32, 34, 37, 0.95);
}

.discord-attachment__control::-webkit-media-controls-enclosure {
  border-radius: 10px;
  background-color: transparent;
}

.discord-attachment--file {
  padding: 0;
}

.discord-attachment--file a {
  color: inherit;
}

.discord-message .external-icon {
  display: none !important;
}

.discord-thread-wrapper {
  position: relative;
  max-width: min(720px, 100%);
  scroll-margin-top: 120px;
}

.discord-thread-share-container.article-share {
  position: absolute;
  top: 12px;
  right: 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  width: max-content;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(0, -6px, 0);
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 4;
}

.discord-thread-share-container.article-share .article-share__feedback {
  text-align: right;
  min-height: 0.85rem;
}

.discord-thread-share.article-share__button {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #d6dae3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, color 0.18s ease;
}

.discord-thread-share__icon {
  width: 18px;
  height: 18px;
  display: block;
  background-color: currentColor;
  mask-image: url(${SHARE_ICON_MASK_URL});
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: url(${SHARE_ICON_MASK_URL});
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}


.discord-thread-wrapper:hover .discord-thread-share-container,
.discord-thread-wrapper:focus-within .discord-thread-share-container,
.discord-thread-wrapper:target .discord-thread-share-container,
.discord-thread-share-container:focus-within {
  pointer-events: auto;
  transform: translate3d(0, 0, 0);
  opacity: 1;
}

.discord-thread-share.article-share__button:hover {
  color: var(--color-accent-deep);
}

.discord-thread-share.article-share__button:focus-visible {
  outline: 2px solid var(--color-accent-bright);
  outline-offset: 2px;
}

.discord-thread-wrapper:target,
.discord-thread-wrapper:has(.discord-message:target) {
  isolation: isolate;
  z-index: 6;
}

.discord-thread-wrapper:target .discord-thread-content,
.discord-thread-wrapper:has(.discord-message:target) .discord-thread-content {
  overflow: visible;
}

.discord-thread-wrapper:target .discord-thread-fade,
.discord-thread-wrapper:has(.discord-message:target) .discord-thread-fade {
  opacity: 0;
}

.discord-thread-wrapper:target .discord-thread,
.discord-message:target {
  position: relative;
  z-index: 2;
}

.discord-message:target {
  isolation: isolate;
}

@media (hover: none) {
  .discord-thread-share-container {
    opacity: 1;
    pointer-events: auto;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes discord-target-glow {
  0% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0.65), 0 0 0 rgba(235, 28, 36, 0.1);
  }
  35% {
    box-shadow: 0 0 0 6px rgba(235, 28, 36, 0.25), 0 0 30px rgba(235, 28, 36, 0.45);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(235, 28, 36, 0);
  }
}

.discord-message:target,
.discord-thread-wrapper:target .discord-thread {
  animation: discord-target-glow 1.6s ease-out;
  box-shadow: 0 0 0 2px rgba(235, 28, 36, 0.45), 0 0 24px rgba(235, 28, 36, 0.35);
}

.discord-timestamp-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.discord-cite {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: baseline;
}

.discord-cite__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background 120ms ease;
  color: var(--discord-cite-icon, #b71002);
  position: relative;
  top: -0.3em;
}

.discord-cite__trigger svg {
  width: 14px;
  height: 14px;
  display: block;
  fill: currentColor;
  pointer-events: none;
}

.discord-cite__trigger:hover {
  background: rgba(88, 101, 242, 0.2);
  color: var(--discord-cite-icon-hover, #eb1c24);
}

.discord-cite__trigger:focus-visible {
  outline: 2px solid var(--discord-accent);
  outline-offset: 2px;
}

.discord-cite__preview {
  position: absolute;
  z-index: 50;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  display: none;
  max-width: min(480px, 85vw);
}

.discord-cite__preview::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-bottom-color: var(--discord-border);
}

.discord-cite:hover .discord-cite__preview,
.discord-cite:focus-within .discord-cite__preview {
  display: block;
}

.discord-cite__preview-content {
  position: relative;
  z-index: 1;
  box-shadow: 0 24px 48px rgba(15, 15, 20, 0.45);
  border-radius: 12px;
  overflow: hidden;
}

.discord-cite__preview .discord-thread {
  max-width: min(520px, 85vw);
  min-width: min(420px, 75vw);
}

.discord-cite__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.callout.discord-cite {
  display: none !important;
}
`

const isExternalUrl = (url: string): boolean => /^(https?:)?\/\//i.test(url)

const OBSIDIAN_EMBED_PATTERN = /^!?(?:\[\[)(?<target>[^|\]]+)(?:\|[^\]]*)?\]\]$/

const stripContentPrefix = (target: string): string =>
  target.replace(/^[./]+/, "").replace(/^content\//i, "")

const appendAssetVersion = (url: string, version: string): string => {
  if (!version) {
    return url
  }

  return url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`
}

const extractMessageIdentifier = (message: DiscordMessage): string | undefined => {
  const direct = message.id?.trim()
  if (direct) {
    return direct
  }

  const jump = message.jump_url ?? message.url
  if (jump) {
    const parts = jump.trim().split("/")
    const candidate = parts.pop() ?? ""
    if (candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return undefined
}

const normaliseFragment = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")

const buildMessageAnchorId = (
  message: DiscordMessage,
  context?: { index: number; threadId: string },
): string | undefined => {
  const fallback = context ? `${context.threadId}-message-${context.index + 1}` : undefined
  const source = extractMessageIdentifier(message) ?? fallback
  if (!source) {
    return undefined
  }

  const fragment = normaliseFragment(source)
  if (!fragment) {
    return undefined
  }

  return fragment.startsWith("discord-message") ? fragment : `discord-message-${fragment}`
}

const createShareSnippet = (raw?: string): string | undefined => {
  if (!raw) {
    return undefined
  }

  const cleaned = raw.replace(/\s+/g, " ").trim()
  if (!cleaned) {
    return undefined
  }

  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned
}

const toOptionalFragment = (raw?: string | null): string | undefined => {
  if (!raw) {
    return undefined
  }

  const fragment = normaliseFragment(raw)
  return fragment.length > 0 ? fragment : undefined
}

const buildThreadAnchorMetadata = (
  messages: DiscordMessage[],
  slug?: FullSlug,
): { anchorId: string; snippet?: string } => {
  const primary = messages.find((message) => Boolean(message))
  const snippet = primary ? createShareSnippet(primary.content) : undefined

  const candidates: Array<string | undefined> = primary
    ? [
        extractMessageIdentifier(primary),
        primary.timestamp,
        primary.author?.id,
        primary.author?.display_name,
        primary.author?.username,
        snippet,
      ]
    : []

  const slugFragment = toOptionalFragment(slug)
  let anchorBase = candidates.map(toOptionalFragment).find((fragment) => fragment)

  if (anchorBase) {
    if (!anchorBase.startsWith("discord-thread")) {
      anchorBase = `discord-thread-${anchorBase}`
    }
  } else {
    anchorBase = slugFragment ? `${slugFragment}-discord-thread` : "discord-thread"
  }

  if (slugFragment && !anchorBase.startsWith(`${slugFragment}-`)) {
    anchorBase = `${slugFragment}-${anchorBase}`
  }

  const sequence = (discordThreadSequence++).toString(36)

  return {
    anchorId: `${anchorBase}-${sequence}`,
    snippet,
  }
}

interface ResolveAssetOptions {
  appendVersion?: boolean
}

const resolveObsidianTarget = (
  rawTarget: string,
  slug: FullSlug,
  options: ResolveAssetOptions = {},
): string => {
  const { appendVersion: shouldAppendVersion = true } = options

  if (isExternalUrl(rawTarget)) {
    return rawTarget
  }

  let targetPath = stripContentPrefix(rawTarget)
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath)
    if (matched) {
      targetPath = matched
    }
  }

  const targetSlug = slugifyFilePath(targetPath as FilePath)
  if (!slug) {
    return shouldAppendVersion ? appendAssetVersion(targetSlug, getAssetVersion()) : targetSlug
  }

  const baseDir = pathToRoot(slug)
  const resolved = joinSegments(baseDir, targetSlug)
  return shouldAppendVersion ? appendAssetVersion(resolved, getAssetVersion()) : resolved
}

const resolveAttachmentSource = (
  raw: string,
  slug?: FullSlug,
  options: ResolveAssetOptions = {},
): string | undefined => {
  const { appendVersion: shouldAppendVersion = true } = options

  const cleaned = raw.trim()
  if (!cleaned) {
    return undefined
  }

  if (isExternalUrl(cleaned) || !slug) {
    return cleaned
  }

  const embedMatch = cleaned.match(OBSIDIAN_EMBED_PATTERN)
  if (embedMatch?.groups?.target) {
    return resolveObsidianTarget(embedMatch.groups.target, slug, { appendVersion: shouldAppendVersion })
  }

  let targetPath = stripContentPrefix(cleaned)
  if (!targetPath.includes("/")) {
    const matched = findAssetByBasename(targetPath)
    if (matched) {
      targetPath = matched
    }
  }

  const targetSlug = slugifyFilePath(targetPath as FilePath)
  if (!slug) {
    return shouldAppendVersion ? appendAssetVersion(targetSlug, getAssetVersion()) : targetSlug
  }

  const baseDir = pathToRoot(slug)
  const resolved = joinSegments(baseDir, targetSlug)
  return shouldAppendVersion ? appendAssetVersion(resolved, getAssetVersion()) : resolved
}

const CITATION_MARKER_PATTERN = /(?:\{\{discord-cite:([a-z0-9-]+)\}\}|<!--\s*discord-cite:([a-z0-9-]+)\s*-->)/gi

type MdNode = {
  type?: string
  children?: MdNode[]
  [key: string]: unknown
}

type MdParent = MdNode & {
  children: MdNode[]
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const escapeAttribute = (value: string): string => escapeHtml(value)

const formatTimestamp = (source?: string): { readable: string; iso: string } | undefined => {
  if (!source) {
    return undefined
  }

  const date = new Date(source)
  if (Number.isNaN(date.getTime())) {
    return {
      readable: source,
      iso: source,
    }
  }

  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear().toString()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

  return {
    readable: `${day}/${month}/${year} ${hours}:${minutes}`,
    iso: date.toISOString(),
  }
}

const normaliseMessages = (raw: unknown): DiscordMessage[] => {
  if (!raw) {
    return []
  }

  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => normaliseMessages(entry))
  }

  if (typeof raw === "object") {
    const maybeMessages = (raw as Record<string, unknown>).messages
    if (Array.isArray(maybeMessages)) {
      return normaliseMessages(maybeMessages)
    }

    return [raw as DiscordMessage]
  }

  return []
}

const renderContent = (content?: string): string => {
  if (!content) {
    return ""
  }

  const safe = escapeHtml(content)
  return safe.replace(/\r?\n/g, "<br />")
}

const normalizeColor = (input?: string | number): string | undefined => {
  if (input === null || input === undefined) {
    return undefined
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    const hex = input.toString(16).padStart(6, "0").slice(-6)
    return `#${hex}`
  }

  const value = input.toString().trim()

  if (/^\d+$/.test(value)) {
    const numeric = Number.parseInt(value, 10)
    if (Number.isFinite(numeric)) {
      const hex = numeric.toString(16).padStart(6, "0").slice(-6)
      return `#${hex}`
    }
  }

  const prefixed = value.startsWith("#") ? value : `#${value}`
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(prefixed)) {
    return prefixed
  }

  if (/^rgb(a)?\(/i.test(value)) {
    return value
  }

  return undefined
}

const getAuthorKey = (message?: DiscordMessage): string | undefined => {
  const author = message?.author
  if (!author) {
    return undefined
  }

  if (author.id) {
    return author.id
  }

  if (author.display_name || author.username) {
    const composite = `${author.username ?? ""}|${author.display_name ?? ""}`.trim()
    if (composite.length > 0) {
      return composite
    }
  }

  return undefined
}

interface RenderMessageOptions {
  wrapperTag?: string
  avatarTag?: string
  bodyTag?: string
  headerTag?: string
  contentTag?: string
}

interface RenderMessagesOptions {
  containerTag?: string
  messageOptions?: RenderMessageOptions
  enableShare?: boolean
  slug?: FullSlug
  wrapperTag?: string
  contentWrapperTag?: string
  collapsible?: boolean
}

const ATTACHMENT_ICON_AUDIO = `
  <img src="${AUDIO_ICON_URL}" alt="" class="discord-attachment__icon-image" loading="lazy" decoding="async" />
`

const ATTACHMENT_ICON_VIDEO = `
  <img src="${VIDEO_ICON_URL}" alt="" class="discord-attachment__icon-image" loading="lazy" decoding="async" />
`

const ATTACHMENT_ICON_FILE = `
  <img src="${FILE_ICON_URL}" alt="" class="discord-attachment__icon-image" loading="lazy" decoding="async" />
`

const renderAttachments = (attachments?: DiscordAttachment[]): string => {
  if (!attachments || attachments.length === 0) {
    return ""
  }

  const decodeFileName = (src: string): string => {
    const withoutQuery = src.split(/[?#]/)[0]
    const segments = withoutQuery.split("/")
    const candidate = segments.pop() ?? ""
    const fallback = candidate.trim().length > 0 ? candidate.trim() : "discord-attachment"
    try {
      return decodeURIComponent(fallback)
    } catch {
      return fallback
    }
  }

  const scrubLabel = (value?: string): string | undefined => {
    if (!value) {
      return undefined
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const buildSubtitle = (attachment: DiscordAttachment, displayName: string): string => {
    const subtitleSource = scrubLabel(attachment.title) ?? scrubLabel(attachment.alt)
    if (!subtitleSource) {
      return ""
    }

    if (subtitleSource.toLowerCase() === displayName.toLowerCase()) {
      return ""
    }

    return `<span class="discord-attachment__subtitle">${escapeHtml(subtitleSource)}</span>`
  }

  const renderCard = (
    type: DiscordAttachmentType,
    src: string,
    displayName: string,
    subtitle: string,
  ): string => {
    const escapedSrc = escapeAttribute(src)
    const typeLabel =
      type === "audio" ? "Audio" : type === "video" ? "Video" : type === "image" ? "Image" : "File"
    const icon =
      type === "audio"
        ? ATTACHMENT_ICON_AUDIO
        : type === "video"
          ? ATTACHMENT_ICON_VIDEO
          : ATTACHMENT_ICON_FILE

    return `<a class="discord-attachment__card discord-attachment__card--${type}" href="${escapedSrc}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttribute(`${typeLabel}: ${displayName}`)}">
      <span class="discord-attachment__icon" aria-hidden="true">${icon}</span>
      <span class="discord-attachment__info">
        <span class="discord-attachment__name">${escapeHtml(displayName)}</span>
        ${subtitle}
      </span>
    </a>`
  }

  const items = attachments
    .map((attachment) => {
      if (!attachment || typeof attachment.src !== "string") {
        return ""
      }

      const type = attachment.type ?? "file"
      const src = attachment.src.trim()
      if (!src) {
        return ""
      }

      const displayName = scrubLabel(attachment.alt) ?? scrubLabel(attachment.title) ?? decodeFileName(src)
      const subtitle = buildSubtitle(attachment, displayName)

      if (type === "image") {
        const altText = scrubLabel(attachment.alt) ?? "Discord attachment"
        const escapedSrc = escapeAttribute(src)
        return `<span class="discord-attachment discord-attachment--image">
        <a class="discord-attachment__image-link" href="${escapedSrc}" target="_blank" rel="noopener noreferrer">
          <img src="${escapedSrc}" alt="${escapeAttribute(altText)}" loading="lazy" decoding="async" />
        </a>
      </span>`
      }

      if (type === "audio") {
        const escapedLabel = escapeAttribute(displayName)
        const card = renderCard(type, src, displayName, subtitle)
        const escapedSrc = escapeAttribute(src)
        return `<span class="discord-attachment discord-attachment--audio">
        ${card}
        <audio class="discord-attachment__control" controls preload="metadata" aria-label="${escapedLabel}">
          <source src="${escapedSrc}" />
        </audio>
      </span>`
      }

      if (type === "video") {
        const escapedLabel = escapeAttribute(displayName)
        const previewSrc = resolveGoogleDrivePreview(src)
        const cardHref = previewSrc ?? src
        const card = renderCard(type, cardHref, displayName, subtitle)

        if (previewSrc) {
          const escapedPreview = escapeAttribute(previewSrc)
          return `<span class="discord-attachment discord-attachment--video">
        ${card}
        <iframe class="discord-attachment__frame" src="${escapedPreview}" title="${escapedLabel}" allow="autoplay; fullscreen; picture-in-picture" loading="lazy" allowfullscreen></iframe>
      </span>`
        }

        const escapedSrc = escapeAttribute(src)
        return `<span class="discord-attachment discord-attachment--video">
        ${card}
        <video class="discord-attachment__control" controls preload="metadata" playsinline aria-label="${escapedLabel}">
          <source src="${escapedSrc}" />
        </video>
      </span>`
      }

      const card = renderCard("file", src, displayName, subtitle)
      return `<span class="discord-attachment discord-attachment--file">
      ${card}
    </span>`
    })
    .filter((html) => html.length > 0)

  if (items.length === 0) {
    return ""
  }

  return `<span class="discord-attachments" role="group" data-discord-jump-skip="true">${items.join("\n")}</span>`
}

const renderMessage = (
  message: DiscordMessage,
  previous?: DiscordMessage,
  options: RenderMessageOptions = {},
  context?: { index: number; threadId: string },
): string => {
  const {
    wrapperTag = "article",
    avatarTag = "div",
    bodyTag = "div",
    headerTag = "div",
    contentTag = "div",
  } = options

  const author = message.author ?? {}
  const displayName = author.display_name?.trim() || author.username?.trim() || "Unknown User"
  const avatar = message.avatar_url?.trim() || DEFAULT_AVATAR
  const timestamp = formatTimestamp(message.timestamp)
  const jumpUrl = message.jump_url || message.url || "#"
  const content = renderContent(message.content)
  const authorColor = normalizeColor(
    author.color ??
      (author as { colour?: string }).colour ??
      (author as { colour_value?: string | number }).colour_value,
  )
  const previousKey = getAuthorKey(previous)
  const currentKey = getAuthorKey(message)
  const sameAuthor = previousKey !== undefined && previousKey === currentKey
  const showHeader = !sameAuthor
  const showAvatar = !sameAuthor

  const articleClasses = ["discord-message"]
  if (!showAvatar) {
    articleClasses.push("discord-message--compact")
  }

  const anchorId = buildMessageAnchorId(message, context)

  const articleAttributes: string[] = [`class="${articleClasses.join(" ")}"`]
  if (message.id) {
    articleAttributes.push(`data-discord-id="${escapeAttribute(message.id)}"`)
  }
  if (anchorId) {
    articleAttributes.push(`id="${escapeAttribute(anchorId)}"`)
  }
  if (authorColor) {
    articleAttributes.push(`style="--discord-author-color: ${escapeAttribute(authorColor)}"`)
  }
  const trimmedJumpUrl = jumpUrl.trim()
  const hasJumpTarget = trimmedJumpUrl.length > 0 && trimmedJumpUrl !== "#"
  if (hasJumpTarget) {
    articleAttributes.push(`data-discord-jump="${escapeAttribute(trimmedJumpUrl)}"`)

    const ariaLabelParts: string[] = [`Open Discord message from ${displayName}`]
    if (timestamp) {
      ariaLabelParts.push(`posted ${timestamp.readable}`)
    }
    const ariaLabel = ariaLabelParts.join(", ")

    articleAttributes.push('role="link"')
    articleAttributes.push('tabindex="0"')
    articleAttributes.push(`aria-label="${escapeAttribute(ariaLabel)}"`)
  }

  const avatarMarkup = showAvatar
    ? `<${avatarTag} class="discord-avatar">
        <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(displayName)}'s avatar" loading="lazy" width="40" height="40" />
      </${avatarTag}>`
    : `<${avatarTag} class="discord-avatar-spacer" aria-hidden="true"></${avatarTag}>`

  const headerMarkup = showHeader
    ? `<${headerTag} class="discord-header">
        <span class="discord-author"${authorColor ? ` style="color: ${escapeAttribute(authorColor)}"` : ""}>${escapeHtml(displayName)}</span>
        ${timestamp ? `<time datetime="${escapeAttribute(timestamp.iso)}">${escapeHtml(timestamp.readable)}</time>` : ""}
      </${headerTag}>`
    : ""

  const accessibleTimestamp = !showHeader && timestamp
    ? `<time class="discord-timestamp-sr" datetime="${escapeAttribute(timestamp.iso)}">${escapeHtml(timestamp.readable)}</time>`
    : ""

  const contentClasses = ["discord-content"]
  if (!showHeader) {
    contentClasses.push("discord-content--compact")
  }

  const attachmentsArray = Array.isArray(message.attachments)
    ? (message.attachments as DiscordAttachment[])
    : undefined
  const attachmentsMarkup = renderAttachments(attachmentsArray)
  const attributes = articleAttributes.join(" ")

  return `<${wrapperTag} ${attributes}>
      ${avatarMarkup}
      <${bodyTag} class="discord-body">
        ${headerMarkup}
        <${contentTag} class="${contentClasses.join(" ")}">${content}${accessibleTimestamp}</${contentTag}>
        ${attachmentsMarkup}
      </${bodyTag}>
  </${wrapperTag}>`
}

const renderMessages = (messages: DiscordMessage[], options: RenderMessagesOptions = {}): string => {
  if (messages.length === 0) {
    return ""
  }

  const {
    containerTag = "section",
    messageOptions,
    enableShare = true,
    slug,
    wrapperTag = "div",
    contentWrapperTag = "div",
    collapsible = true,
  } = options

  const { anchorId: wrapperAnchorId, snippet: primarySnippet } = buildThreadAnchorMetadata(messages, slug)

  const htmlMessages = messages
    .map((message, index) =>
      renderMessage(message, index > 0 ? messages[index - 1] : undefined, messageOptions, {
        index,
        threadId: wrapperAnchorId,
      }),
    )
    .join("\n")

  let shareMarkup = ""
  if (enableShare) {
    const messageCount = messages.length
    const countLabel = messageCount === 1 ? "Share Discord message" : `Share Discord thread (${messageCount} messages)`
    const shareTitle = messageCount === 1 ? "Discord message" : "Discord thread"
    const shareAttributes: string[] = [
      'type="button"',
      'class="discord-thread-share article-share__button"',
      `aria-label="${escapeAttribute(countLabel)}"`,
      `data-share-url="#${escapeAttribute(wrapperAnchorId)}"`,
      `data-share-title="${escapeAttribute(shareTitle)}"`,
    ]

    const shareText = primarySnippet ?? createShareSnippet(messages[0]?.content)
    if (shareText) {
      shareAttributes.push(`data-share-text="${escapeAttribute(shareText)}"`)
    }

  shareAttributes.push('data-share-copied="URL copied"')

    shareMarkup = `<div class="discord-thread-share-container article-share">
      <button ${shareAttributes.join(" ")}>
        <span class="discord-thread-share__icon" aria-hidden="true"></span>
      </button>
      <span class="article-share__feedback" aria-live="polite"></span>
    </div>`
  }

  const wrapperClasses = ["discord-thread-wrapper"]
  const contentClasses = ["discord-thread-content"]

  if (collapsible) {
    wrapperClasses.push("collapsed")
    contentClasses.push("collapsed")
  }

  const fadeMarkup = collapsible
    ? `<div class="discord-thread-fade" aria-hidden="true"></div>`
    : ""

  const collapseToggleMarkup = collapsible
    ? `<button class="discord-collapse-toggle" aria-expanded="false" aria-controls="${wrapperAnchorId}-content" data-discord-toggle="${wrapperAnchorId}">
    <span>Show More</span>
    <svg class="discord-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>`
    : ""

  return `<${wrapperTag} class="${wrapperClasses.join(" ")}" id="${wrapperAnchorId}">
  ${shareMarkup}
  <${contentWrapperTag} class="${contentClasses.join(" ")}" id="${wrapperAnchorId}-content">
    <${containerTag} class="discord-thread" data-message-count="${messages.length}">
${htmlMessages}
    </${containerTag}>
    ${fadeMarkup}
  </${contentWrapperTag}>
  ${collapseToggleMarkup}
</${wrapperTag}>`
}

const renderCitation = (id: string, messages: DiscordMessage[], slug?: FullSlug): string | undefined => {
  const threadHtml = renderMessages(messages, {
    containerTag: "span",
    messageOptions: {
      wrapperTag: "span",
      avatarTag: "span",
      bodyTag: "span",
      headerTag: "span",
      contentTag: "span",
    },
    enableShare: false,
    slug,
    wrapperTag: "span",
    contentWrapperTag: "span",
    collapsible: false,
  })
  if (!threadHtml) {
    return undefined
  }

  const count = messages.length
  const labelText = count === 1 ? "View Discord citation (1 message)" : `View Discord citation (${count} messages)`

  return `<span class="discord-cite" data-discord-id="${escapeAttribute(id)}">
    <button type="button" class="discord-cite__trigger" aria-label="${escapeAttribute(labelText)}" title="${escapeAttribute(labelText)}">
      <svg viewBox="0 0 32 32" role="img" aria-hidden="true" focusable="false">
        <path d="${DISCORD_CITE_ICON_PATH}" />
      </svg>
      <span class="discord-cite__sr">${escapeHtml(labelText)}</span>
    </button>
    <span class="discord-cite__preview" role="dialog" aria-modal="false">
      <span class="discord-cite__preview-content">${threadHtml}</span>
    </span>
  </span>`
}

type AttachmentDescriptor = {
  target: string
  alt?: string
  typeHint?: string
  title?: string
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "apng",
  "avif",
  "gif",
  "jpg",
  "jpeg",
  "jfif",
  "pjpeg",
  "pjp",
  "svg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
])

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "opus",
  "flac",
  "aac",
  "m4a",
  "weba",
  "mid",
  "midi",
])

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "m4v",
  "mov",
  "webm",
  "ogv",
  "ogg",
  "mkv",
  "avi",
  "wmv",
  "flv",
  "gifv",
])

const normaliseAttachmentDescriptors = (value: unknown): AttachmentDescriptor[] => {
  if (value === null || value === undefined) {
    return []
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [{ target: trimmed }] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normaliseAttachmentDescriptors(entry))
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const candidateValues = [
      record.target,
      record.src,
      record.attachment,
      record.url,
      record.path,
      record.href,
      record.file,
      record.source,
    ]
    const source = candidateValues.find(
      (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
    )

    if (!source) {
      return []
    }

    const altValue = record.alt
    const alt = typeof altValue === "string" ? altValue.trim() : undefined
    const typeValue = record.type ?? record.mtype ?? record.kind
    const typeHint = typeof typeValue === "string" ? typeValue.trim() : undefined
    const titleValue = record.title ?? record.name ?? record.label ?? record.caption ?? record.description
    const title = typeof titleValue === "string" ? titleValue.trim() : undefined

    return [
      {
        target: source.trim(),
        alt: alt && alt.length > 0 ? alt : undefined,
        typeHint: typeHint && typeHint.length > 0 ? typeHint : undefined,
        title: title && title.length > 0 ? title : undefined,
      },
    ]
  }

  return []
}

const toLowerSafe = (value?: string): string | undefined =>
  typeof value === "string" ? value.trim().toLowerCase() : undefined

const extractExtension = (source: string): string | undefined => {
  if (!source) {
    return undefined
  }

  const withoutQuery = source.split(/[?#]/)[0]?.trim()
  if (!withoutQuery) {
    return undefined
  }

  const lastDot = withoutQuery.lastIndexOf(".")
  if (lastDot === -1 || lastDot === withoutQuery.length - 1) {
    return undefined
  }

  return withoutQuery.slice(lastDot + 1).toLowerCase()
}

const resolveGoogleDrivePreview = (source: string): string | undefined => {
  if (typeof source !== "string" || source.length === 0) {
    return undefined
  }

  if (!/^https?:\/\//i.test(source)) {
    return undefined
  }

  let url: URL
  try {
    url = new URL(source)
  } catch {
    return undefined
  }

  const hostname = url.hostname.toLowerCase()
  if (!hostname.endsWith("drive.google.com")) {
    return undefined
  }

  const pathname = url.pathname
  if (!pathname.includes("/file/")) {
    return undefined
  }

  let adjustedPath = pathname
  if (adjustedPath.includes("/view")) {
    adjustedPath = adjustedPath.replace(/\/view(?=\/?$)/, "/preview")
  }

  if (!adjustedPath.endsWith("/preview")) {
    adjustedPath = adjustedPath.replace(/\/+$/, "")
    adjustedPath = `${adjustedPath}/preview`
  }

  return `${url.origin}${adjustedPath}${url.search}`
}

const determineAttachmentType = (src: string, hint?: string): DiscordAttachmentType => {
  const hintValue = toLowerSafe(hint)

  if (hintValue) {
    if (hintValue.includes("image") || hintValue === "img" || hintValue === "picture" || hintValue === "photo") {
      return "image"
    }

    if (
      hintValue.includes("audio") ||
      hintValue.includes("sound") ||
      hintValue.includes("voice") ||
      hintValue === "music"
    ) {
      return "audio"
    }

    if (hintValue.includes("video") || hintValue === "gifv" || hintValue === "movie") {
      return "video"
    }
  }

  const extension = extractExtension(src)

  if (resolveGoogleDrivePreview(src)) {
    return "video"
  }

  if (extension) {
    if (IMAGE_EXTENSIONS.has(extension)) {
      return "image"
    }

    if (AUDIO_EXTENSIONS.has(extension)) {
      return "audio"
    }

    if (VIDEO_EXTENSIONS.has(extension)) {
      return "video"
    }
  }

  return "file"
}

const applyAttachmentMetadataToMessages = (messages: DiscordMessage[], slug?: FullSlug): void => {
  messages.forEach((message) => {
    if (!message || typeof message !== "object") {
      return
    }

    const raw = message as DiscordMessage & {
      image?: unknown
      images?: unknown
      image_alt?: unknown
      imageAlt?: unknown
      attachment?: unknown
      attachment_alt?: unknown
      attachmentAlt?: unknown
      attachments?: unknown
    }

    const descriptors: AttachmentDescriptor[] = [
      ...normaliseAttachmentDescriptors(raw.attachments),
      ...normaliseAttachmentDescriptors(raw.attachment),
      ...normaliseAttachmentDescriptors(raw.image),
      ...normaliseAttachmentDescriptors(raw.images),
    ]

    if (descriptors.length === 0) {
      delete raw.image
      delete raw.images
      delete raw.image_alt
      delete raw.imageAlt
      delete raw.attachment
      delete raw.attachment_alt
      delete raw.attachmentAlt
      if (!Array.isArray(message.attachments)) {
        delete message.attachments
      }
      return
    }

    const altFallbacks = [
      typeof raw.attachment_alt === "string" ? raw.attachment_alt.trim() : undefined,
      typeof raw.attachmentAlt === "string" ? raw.attachmentAlt.trim() : undefined,
      typeof raw.image_alt === "string" ? raw.image_alt.trim() : undefined,
      typeof raw.imageAlt === "string" ? raw.imageAlt.trim() : undefined,
    ].filter((value): value is string => Boolean(value))

    let fallbackIndex = 0
    descriptors.forEach((descriptor) => {
      if (!descriptor.alt && fallbackIndex < altFallbacks.length) {
        const fallback = altFallbacks[fallbackIndex]
        if (fallback) {
          descriptor.alt = fallback
        }
        fallbackIndex += 1
      }
    })

    const seenSources = new Set<string>()
    const resolved: DiscordAttachment[] = []

    descriptors.forEach((descriptor) => {
      const src = resolveAttachmentSource(descriptor.target, slug, { appendVersion: false })
      if (!src) {
        return
      }

      const trimmedSrc = src.trim()
      if (!trimmedSrc || seenSources.has(trimmedSrc)) {
        return
      }

      seenSources.add(trimmedSrc)
      resolved.push({
        type: determineAttachmentType(trimmedSrc, descriptor.typeHint),
        src: trimmedSrc,
        alt: descriptor.alt && descriptor.alt.trim().length > 0 ? descriptor.alt.trim() : undefined,
        title: descriptor.title && descriptor.title.trim().length > 0 ? descriptor.title.trim() : undefined,
      })
    })

    if (resolved.length > 0) {
      message.attachments = resolved
    } else {
      delete message.attachments
    }

    delete raw.image
    delete raw.images
    delete raw.image_alt
    delete raw.imageAlt
    delete raw.attachment
    delete raw.attachment_alt
    delete raw.attachmentAlt
  })
}

const parseDiscordBlock = (value: string, slug?: FullSlug): DiscordMessage[] => {
  try {
    const data = JSON.parse(value.trim()) as unknown
    const messages = normaliseMessages(data)
    if (messages.length > 0) {
      applyAttachmentMetadataToMessages(messages, slug)
    }
    return messages
  } catch (error) {
    console.warn("Failed to parse discord block", error)
    return []
  }
}

const visitCodeBlocks = (
  node: MdNode | undefined,
  callback: (code: MdNode, index: number, parent: MdParent) => void,
) => {
  if (!node || typeof node !== "object" || !Array.isArray(node.children)) {
    return
  }

  const parent = node as MdParent

  for (let idx = 0; idx < parent.children.length; idx++) {
    const child = parent.children[idx]
    if (!child || typeof child !== "object") {
      continue
    }

    if (child.type === "code") {
      callback(child, idx, parent)
    }

    visitCodeBlocks(child, callback)
  }
}

const replaceCitationMarkers = (
  value: string,
  citations: Map<string, DiscordMessage[]>,
  slug?: FullSlug,
): MdNode[] | null => {
  CITATION_MARKER_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  let lastIndex = 0
  const nodes: MdNode[] = []
  let replaced = false

  while ((match = CITATION_MARKER_PATTERN.exec(value)) !== null) {
    const start = match.index
    const end = start + match[0].length
    const id = match[1] ?? match[2]
    if (!id) {
      continue
    }

    if (start > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, start) })
    }

    const messages = citations.get(id) ?? []
    if (messages.length > 0) {
      const citationHtml = renderCitation(id, messages, slug)
      if (citationHtml) {
        nodes.push({ type: "html", value: citationHtml })
        replaced = true
      } else {
        nodes.push({ type: "text", value: match[0] })
      }
    } else {
      nodes.push({ type: "text", value: match[0] })
    }

    lastIndex = end
  }

  if (!replaced) {
    return null
  }

  if (lastIndex < value.length) {
    nodes.push({ type: "text", value: value.slice(lastIndex) })
  }

  return nodes.filter((node) => {
    if (node.type !== "text") {
      return true
    }

    const textValue = (node as { value?: unknown }).value
    return typeof textValue !== "string" || textValue.length > 0
  })
}

const collectTextContent = (node: MdNode | undefined): string => {
  if (!node || typeof node !== "object") {
    return ""
  }

  const value = (node as { value?: unknown }).value
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(node.children)) {
    return node.children.map((child) => collectTextContent(child)).join("")
  }

  return ""
}

const findCodeBlockNode = (
  node: MdNode | undefined,
): (MdNode & { lang?: string; value?: string }) | undefined => {
  if (!node || typeof node !== "object") {
    return undefined
  }

  if (node.type === "code" && typeof (node as { value?: unknown }).value === "string") {
    return node as MdNode & { lang?: string; value?: string }
  }

  if (!Array.isArray(node.children)) {
    return undefined
  }

  for (const child of node.children) {
    const found = findCodeBlockNode(child as MdNode)
    if (found) {
      return found
    }
  }

  return undefined
}

const isDiscordCitationCallout = (node: MdNode | undefined): boolean => {
  if (!node || typeof node !== "object") {
    return false
  }

  const type = (node as { type?: string }).type

  if (type === "containerDirective" || type === "leafDirective" || type === "textDirective") {
    const directiveName = ((node as { name?: string }).name ?? "").toLowerCase()
    return directiveName === "discord-cite"
  }

  if (type !== "blockquote") {
    return false
  }

  const hProperties = (node as { data?: { hProperties?: Record<string, unknown> } }).data?.hProperties
  const calloutValue = typeof hProperties?.["data-callout"] === "string"
    ? (hProperties["data-callout"] as string).toLowerCase()
    : undefined

  if (calloutValue === "discord-cite") {
    return true
  }

  if (!Array.isArray(node.children) || node.children.length === 0) {
    return false
  }

  const firstChild = node.children[0]
  if (!firstChild || typeof firstChild !== "object") {
    return false
  }

  if (firstChild.type === "paragraph") {
    const text = collectTextContent(firstChild).trim().toLowerCase()
    return text.startsWith("[!discord-cite")
  }

  return false
}

const extractCitationDataFromCallout = (
  node: MdParent,
  slug?: FullSlug,
):
  | { id: string; messages: DiscordMessage[] }
  | undefined => {
  if (!Array.isArray(node.children)) {
    return undefined
  }

  const codeBlock = findCodeBlockNode(node)

  if (!codeBlock || typeof codeBlock.value !== "string") {
    return undefined
  }

  const raw = codeBlock.value.trim()
  if (raw.length === 0) {
    return undefined
  }

  try {
    const parsed = JSON.parse(raw) as { id?: unknown; messages?: unknown }
    const id = typeof parsed.id === "string" ? parsed.id.trim() : undefined
    const messages = normaliseMessages(
      parsed.messages !== undefined ? parsed.messages : parsed,
    )

    if (!id || messages.length === 0) {
      return undefined
    }

    if (messages.length > 0) {
      applyAttachmentMetadataToMessages(messages, slug)
    }

    return { id, messages }
  } catch (error) {
    const preview = raw.slice(0, 160)
    const slugLabel = slug ?? "unknown"
    console.warn(
      `Failed to parse Discord citation callout payload for ${slugLabel}`,
      error,
      { preview },
    )
    return undefined
  }
}

const collectCitationCallouts = (root: MdNode, slug?: FullSlug): Map<string, DiscordMessage[]> => {
  const citations = new Map<string, DiscordMessage[]>()
  const removals: Array<{ parent: MdParent; index: number }> = []

  const traverse = (current: MdNode | undefined) => {
    if (!current || typeof current !== "object") {
      return
    }

    const parent = current as MdParent
    if (!Array.isArray(parent.children)) {
      return
    }

    for (let idx = 0; idx < parent.children.length; idx++) {
      const child = parent.children[idx]
      if (!child || typeof child !== "object") {
        continue
      }

      if (isDiscordCitationCallout(child)) {
        const data = extractCitationDataFromCallout(child as MdParent, slug)
        if (data) {
          citations.set(data.id, data.messages)
        } else {
          console.warn("Unable to extract Discord citation data from callout")
        }

        removals.push({ parent, index: idx })
        continue
      }

      traverse(child as MdNode)
    }
  }

  traverse(root)

  for (let idx = removals.length - 1; idx >= 0; idx--) {
    const { parent, index } = removals[idx]
    if (!Array.isArray(parent.children)) {
      continue
    }

    parent.children.splice(index, 1)
  }

  return citations
}

const transformCitationMarkers = (
  root: MdNode,
  citations: Map<string, DiscordMessage[]>,
  slug?: FullSlug,
): void => {
  const traverse = (node: MdNode | undefined) => {
    if (!node || typeof node !== "object") {
      return
    }

    const parent = node as MdParent
    if (!Array.isArray(parent.children)) {
      return
    }

    for (let idx = 0; idx < parent.children.length; idx++) {
      const child = parent.children[idx]
      if (!child || typeof child !== "object") {
        continue
      }

      const value = typeof (child as { value?: unknown }).value === "string"
        ? ((child as { value: string }).value ?? "")
        : undefined

      if (typeof value === "string") {
  const replacements = replaceCitationMarkers(value, citations, slug)
        if (replacements) {
          parent.children.splice(idx, 1, ...replacements)
          idx += replacements.length - 1
          continue
        }
      }

      traverse(child as MdNode)
    }
  }

  traverse(root)
}

// @ts-ignore
import discordCollapseScript from "../../components/scripts/discordCollapse.inline"
// @ts-ignore
import discordMessageJumpScript from "../../components/scripts/discordMessageJump.inline"

export const DiscordMessages: QuartzTransformerPlugin = () => {
  return {
    name: "DiscordMessages",
    markdownPlugins() {
      return [
        () => (tree: unknown, file: { data?: { slug?: FullSlug } }) => {
          const root = tree as MdNode
          const slug = typeof file?.data?.slug === "string" ? (file.data.slug as FullSlug) : undefined
          const citations = collectCitationCallouts(root, slug)
          transformCitationMarkers(root, citations, slug)

          visitCodeBlocks(root, (codeBlock, index, parent) => {
            const lang = typeof codeBlock.lang === "string" ? codeBlock.lang.toLowerCase() : ""
            if (lang !== "discord") {
              return
            }

            const raw = typeof codeBlock.value === "string" ? codeBlock.value : ""
            const messages = parseDiscordBlock(raw, slug)
            if (messages.length === 0) {
              return
            }

            const html = renderMessages(messages, { slug })

            if (parent.type === "paragraph" && parent.children?.length === 1) {
              delete (parent as MdNode).children
              ;(parent as MdNode).type = "html"
              ;(parent as MdNode & { value: string }).value = html
              return
            }

            parent.children.splice(index, 1, {
              type: "html",
              value: html,
            })
          })
        },
      ]
    },
    externalResources() {
      return {
        css: [
          {
            content: DISCORD_CSS,
            inline: true,
          },
        ],
        js: [
          {
            script: discordCollapseScript,
            loadTime: "afterDOMReady",
            contentType: "inline",
          },
          {
            script: discordMessageJumpScript,
            loadTime: "afterDOMReady",
            contentType: "inline",
          },
        ],
      }
    },
  }
}

export default DiscordMessages
