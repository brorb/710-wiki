import { QuartzTransformerPlugin } from "../types"

interface DiscordAuthor {
  display_name?: string
  username?: string
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
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(720px, 100%);
  font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.discord-thread[data-message-count="1"] {
  padding-bottom: 12px;
}

.discord-message {
  position: relative;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  border-radius: 8px;
  padding: 6px 8px;
  color: var(--discord-text-primary);
}

.discord-message:hover {
  background: var(--discord-hover);
}

.discord-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
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
}

.discord-author {
  font-weight: 600;
  color: var(--discord-author);
}

.discord-header time {
  font-size: 0.8125rem;
  color: var(--discord-text-muted);
}

.discord-content {
  font-size: 0.95rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.discord-jump {
  position: absolute;
  inset: 0;
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

const renderMessage = (message: DiscordMessage): string => {
  const author = message.author ?? {}
  const displayName = author.display_name?.trim() || author.username?.trim() || "Unknown User"
  const avatar = message.avatar_url?.trim() || DEFAULT_AVATAR
  const timestamp = formatTimestamp(message.timestamp)
  const jumpUrl = message.jump_url || message.url || "#"
  const content = renderContent(message.content)

  const metadata: string[] = []
  if (message.id) {
    metadata.push(`data-discord-id="${escapeAttribute(message.id)}"`)
  }

  return `<article class="discord-message" ${metadata.join(" ")}>
    <div class="discord-avatar">
      <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(displayName)}'s avatar" loading="lazy" width="48" height="48" />
    </div>
    <div class="discord-body">
      <header class="discord-header">
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
