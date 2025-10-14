import { QuartzTransformerPlugin } from "../types"

interface DiscordAuthor {
  id?: string
  display_name?: string
  username?: string
  color?: string
  colour?: string
  colour_value?: number | string
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
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: min(720px, 100%);
  font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.discord-message {
  position: relative;
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  border-radius: 8px;
  padding: 8px 8px 6px;
  color: var(--discord-text-primary);
  align-items: flex-start;
  --discord-author-color: var(--discord-author);
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
  margin-top: 12px;
}

.discord-avatar--hidden {
  visibility: hidden;
  margin-top: 12px;
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
  word-break: break-word;
}

.discord-content--compact {
  margin-top: 2px;
}

.discord-message .external-icon {
  display: none !important;
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
}

.discord-cite__trigger img {
  width: 16px;
  height: 16px;
  display: block;
}

.discord-cite__trigger:hover {
  background: rgba(88, 101, 242, 0.2);
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
  max-width: min(480px, 85vw);
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
`

const CITATION_MARKER_PATTERN = /\{\{discord-cite:([a-z0-9-]+)\}\}/gi
const CITATION_COMMENT_PATTERN = /^%%\s*discord-cite:([a-z0-9-]+)\|([A-Za-z0-9+/=]+)\s*%%$/i

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

const renderMessage = (message: DiscordMessage, previous?: DiscordMessage): string => {
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

  const articleAttributes: string[] = [`class="${articleClasses.join(" ")}"`]
  if (message.id) {
    articleAttributes.push(`data-discord-id="${escapeAttribute(message.id)}"`)
  }
  if (authorColor) {
    articleAttributes.push(`style="--discord-author-color: ${escapeAttribute(authorColor)}"`)
  }

  const avatarMarkup = showAvatar
    ? `<div class="discord-avatar">
        <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(displayName)}'s avatar" loading="lazy" width="40" height="40" />
      </div>`
    : `<div class="discord-avatar discord-avatar--hidden" aria-hidden="true"></div>`

  const headerMarkup = showHeader
    ? `<header class="discord-header">
        <span class="discord-author"${authorColor ? ` style="color: ${escapeAttribute(authorColor)}"` : ""}>${escapeHtml(displayName)}</span>
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

  const attributes = articleAttributes.join(" ")

  return `<article ${attributes}>
    ${avatarMarkup}
    <div class="discord-body">
      ${headerMarkup}
      <div class="${contentClasses.join(" ")}">${content}${accessibleTimestamp}</div>
    </div>
    <a class="discord-jump" href="${escapeAttribute(jumpUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open Discord message in a new tab"></a>
  </article>`
}

const renderMessages = (messages: DiscordMessage[]): string => {
  if (messages.length === 0) {
    return ""
  }

  const htmlMessages = messages
    .map((message, index) => renderMessage(message, index > 0 ? messages[index - 1] : undefined))
    .join("\n")
  return `<section class="discord-thread" data-message-count="${messages.length}">
${htmlMessages}
</section>`
}

const renderCitation = (id: string, messages: DiscordMessage[]): string | undefined => {
  const threadHtml = renderMessages(messages)
  if (!threadHtml) {
    return undefined
  }

  const count = messages.length
  const labelText = count === 1 ? "View Discord citation (1 message)" : `View Discord citation (${count} messages)`

  return `<span class="discord-cite" data-discord-id="${escapeAttribute(id)}">
    <button type="button" class="discord-cite__trigger" aria-label="${escapeAttribute(labelText)}" title="${escapeAttribute(labelText)}">
      <img src="/static/discord.svg" alt="" aria-hidden="true" loading="lazy" width="16" height="16" />
      <span class="discord-cite__sr">${escapeHtml(labelText)}</span>
    </button>
    <span class="discord-cite__preview" role="dialog" aria-modal="false">
      <span class="discord-cite__preview-content">${threadHtml}</span>
    </span>
  </span>`
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

const decodeCitationPayload = (encoded: string): DiscordMessage[] => {
  try {
    const json = Buffer.from(encoded, "base64").toString("utf8")
    const data = JSON.parse(json) as unknown
    return normaliseMessages(data)
  } catch (error) {
    console.warn("Failed to decode Discord citation payload", error)
    return []
  }
}

const collectCitationPayloads = (root: MdNode): Map<string, DiscordMessage[]> => {
  const citations = new Map<string, DiscordMessage[]>()
  const removals: Array<{ parent: MdParent; index: number }> = []

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
        const trimmed = value.trim()
        const match = CITATION_COMMENT_PATTERN.exec(trimmed)
        if (match) {
          const [, id, encoded] = match
          let messages = citations.get(id)

          if (!messages) {
            messages = decodeCitationPayload(encoded)
            if (messages.length === 0) {
              console.warn(`Discord citation '${id}' payload contained no messages.`)
              CITATION_COMMENT_PATTERN.lastIndex = 0
              continue
            }

            citations.set(id, messages)
          }

          removals.push({ parent, index: idx })
          CITATION_COMMENT_PATTERN.lastIndex = 0
          continue
        }

        CITATION_COMMENT_PATTERN.lastIndex = 0
      }

      traverse(child as MdNode)
    }
  }

  traverse(root)

  for (let i = removals.length - 1; i >= 0; i--) {
    const { parent, index } = removals[i]
    if (!Array.isArray(parent.children)) {
      continue
    }

    parent.children.splice(index, 1)
  }

  return citations
}

const replaceCitationMarkers = (
  value: string,
  citations: Map<string, DiscordMessage[]>,
): MdNode[] | null => {
  CITATION_MARKER_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  let lastIndex = 0
  const nodes: MdNode[] = []
  let replaced = false

  while ((match = CITATION_MARKER_PATTERN.exec(value)) !== null) {
    const start = match.index
    const end = start + match[0].length
    const id = match[1]

    if (start > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, start) })
    }

    const messages = citations.get(id)
    if (messages && messages.length > 0) {
      const citationHtml = renderCitation(id, messages)
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

const transformCitationMarkers = (root: MdNode, citations: Map<string, DiscordMessage[]>): void => {
  if (citations.size === 0) {
    return
  }

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
        const replacements = replaceCitationMarkers(value, citations)
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

export const DiscordMessages: QuartzTransformerPlugin = () => {
  return {
    name: "DiscordMessages",
    markdownPlugins() {
      return [
        () => (tree: unknown) => {
          const root = tree as MdNode
          const citations = collectCitationPayloads(root)
          transformCitationMarkers(root, citations)

          visitCodeBlocks(root, (codeBlock, index, parent) => {
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
      }
    },
  }
}

export default DiscordMessages