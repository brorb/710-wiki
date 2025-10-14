import { QuartzTransformerPlugin } from "../types"

interface DiscordAuthor {
  display_name?: string
  username?: string
  color?: string
  colour?: string
}

interface DiscordMessage {
  url?: string
  jump_url?: string
  id?: string
  content?: string
  timestamp?: string
  avatar_url?: string
  author?: DiscordAuthor
}
  id?: string

const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"

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
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: min(720px, 100%);
  font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.discord-thread[data-message-count="1"] {
  grid-template-columns: 40px 1fr;
  gap: 12px;

  padding: 6px 8px;
  position: relative;
  align-items: flex-start;
  --discord-author-color: var(--discord-author);
  grid-template-columns: 48px 1fr;
  gap: 12px;
  border-radius: 8px;
  padding: 6px 8px;
  color: var(--discord-text-primary);
  align-items: flex-start;
}
  grid-row: span 2;
  width: 40px;
  min-width: 40px;
  height: 40px;
  aspect-ratio: 1 / 1;
  background: var(--discord-hover);
}

.discord-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  visibility: hidden;
}
  overflow: hidden;
  background: #1f2125;
  border: 1px solid rgba(0, 0, 0, 0.2);
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
  gap: 2px;
}

.discord-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  line-height: 1.25;
  margin-bottom: 2px;
  color: var(--discord-author-color, var(--discord-author));

.discord-author {
  font-weight: 600;
  color: var(--discord-author-color, var(--discord-author));
}

.discord-header time {
  font-size: 0.8125rem;
  color: var(--discord-text-muted);
}

.discord-content {
  font-size: 0.95rem;
  line-height: 1.4;
  white-space: pre-wrap;
  margin-top: 2px;
}
  word-break: break-word;
}
  padding-top: 2px;
}

.discord-jump {
  margin-top: 4px;
}
  position: absolute;
  inset: 0;
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  border-radius: inherit;
  text-decoration: none;
}

.discord-jump:focus-visible {
  outline: 2px solid var(--discord-accent);
  outline-offset: 2px;
}
`

type MdNode = {
  type?: string
  children?: MdNode[]
  [key: string]: unknown
}

type MdParent = MdNode & {
  children: MdNode[]
}

const escapeHtml = (value: string): string =>
const getAuthorKey = (message?: DiscordMessage): string | undefined => {
  if (!message?.author) {
    return undefined
  }

  const { id, username, display_name } = message.author
  return id ?? `${username ?? ""}|${display_name ?? ""}`.trim() || undefined
}
  value
const renderMessage = (message: DiscordMessage, previous?: DiscordMessage): string => {
  const sameAuthor = getAuthorKey(previous) && getAuthorKey(previous) === getAuthorKey(message)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const escapeAttribute = (value: string): string => escapeHtml(value)
  const authorColor = normalizeColor(author.color ?? (author as unknown as { colour?: string })?.colour)
  const showHeader = !sameAuthor
  const showAvatar = !sameAuthor
  const messageClasses = ["discord-message"]
  if (!showAvatar) {
    messageClasses.push("discord-message--compact")
  }

  const metadata: string[] = [`class="${messageClasses.join(" " )}"`]
  if (message.id) {
    metadata.push(`data-discord-id="${escapeAttribute(message.id)}"`)
  }
  if (authorColor) {
    metadata.push(`style="--discord-author-color: ${escapeAttribute(authorColor)}"`)
  }
  if (!source) {
  const avatarMarkup = showAvatar
    ? `<div class="discord-avatar">
      <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(displayName)}'s avatar" loading="lazy" width="40" height="40" />
    </div>`
    : `<div class="discord-avatar discord-avatar--hidden" aria-hidden="true"></div>`

  const headerMarkup = showHeader
    ? `<header class="discord-header">
        <span class="discord-author">${escapeHtml(displayName)}</span>
        ${timestamp ? `<time datetime="${escapeAttribute(timestamp.iso)}">${escapeHtml(timestamp.readable)}</time>` : ""}
      </header>`
    : ""

  const accessibleTimestamp = !showHeader && timestamp
    ? `<time class="discord-timestamp-sr" datetime="${escapeAttribute(timestamp.iso)}">${escapeHtml(timestamp.readable)}</time>`
    : ""

  const contentClasses = ["discord-content"]
  if (!showHeader) {
    contentClasses.push("discord-content--compact")
  }
  if (Number.isNaN(date.getTime())) {
  return `<article ${metadata.join(" ")}>
    ${avatarMarkup}
    <div class="discord-body">
      ${headerMarkup}
      <div class="${contentClasses.join(" ")}">${content}${accessibleTimestamp}</div>
    </div>
    <a class="discord-jump" href="${escapeAttribute(jumpUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open Discord message in a new tab"></a>
  </article>`
    readable: `${day}/${month}/${year} ${hours}:${minutes}`,
    iso: date.toISOString(),
  }
}

const normaliseMessages = (raw: unknown): DiscordMessage[] => {
  if (!raw) {
  const htmlMessages = messages
    .map((message, index) => renderMessage(message, index > 0 ? messages[index - 1] : undefined))
    .join("\n")
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

const normalizeColor = (input?: string): string | undefined => {
  if (!input) {
    return undefined
  }

  const value = input.trim()

  const prefixed = value.startsWith("#") ? value : `#${value}`
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(prefixed)) {
    return prefixed
  }

  if (/^rgb(a)?\(/i.test(value)) {
    return value
  }

  return undefined
}

const renderMessage = (message: DiscordMessage): string => {
  const author = message.author ?? {}
  const displayName = author.display_name?.trim() || author.username?.trim() || "Unknown User"
  const avatar = message.avatar_url?.trim() || DEFAULT_AVATAR
  const timestamp = formatTimestamp(message.timestamp)
  const jumpUrl = message.jump_url || message.url || "#"
  const content = renderContent(message.content)
  const authorColor = normalizeColor(author.color ?? (author as unknown as { colour?: string })?.colour)
  const colorAttr = authorColor ? ` style="--discord-author-color: ${escapeAttribute(authorColor)}"` : ""

  const metadata: string[] = []
  if (message.id) {
    metadata.push(`data-discord-id="${escapeAttribute(message.id)}"`)
  }

  return `<article class="discord-message" ${metadata.join(" ")}>
    <div class="discord-avatar">
      <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(displayName)}'s avatar" loading="lazy" width="48" height="48" />
    </div>
    <div class="discord-body">
      <header class="discord-header"${colorAttr}>
        <span class="discord-author">${escapeHtml(displayName)}</span>
        ${timestamp ? `<time datetime="${escapeAttribute(timestamp.iso)}">${escapeHtml(timestamp.readable)}</time>` : ""}
      </header>
      <div class="discord-content">${content}</div>
    </div>
    <a class="discord-jump" href="${escapeAttribute(jumpUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open Discord message in a new tab"></a>
  </article>`
}

const renderMessages = (messages: DiscordMessage[]): string => {
  if (messages.length === 0) {
    return ""
  }

  const htmlMessages = messages.map((message) => renderMessage(message)).join("\n")
  return `<section class="discord-thread" data-message-count="${messages.length}">
${htmlMessages}
</section>`
}

const parseDiscordBlock = (value: string): DiscordMessage[] => {
  try {
    const data = JSON.parse(value.trim()) as unknown
    return normaliseMessages(data)
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

export const DiscordMessages: QuartzTransformerPlugin = () => {
  return {
    name: "DiscordMessages",
    markdownPlugins() {
      return [
        () => (tree: unknown) => {
          visitCodeBlocks(tree as MdNode, (codeBlock, index, parent) => {
            const lang = typeof codeBlock.lang === "string" ? codeBlock.lang.toLowerCase() : ""
            if (lang !== "discord") {
              return
            }

            const raw = typeof codeBlock.value === "string" ? codeBlock.value : ""
            const messages = parseDiscordBlock(raw)
            if (messages.length === 0) {
              return
            }

            const html = renderMessages(messages)
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
      }
    },
  }
}

export default DiscordMessages
