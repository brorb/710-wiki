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
  color: var(--discord-cite-icon, #b71002);
}

.discord-cite__trigger svg {
  width: 16px;
  height: 16px;
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
}

const renderMessage = (
  message: DiscordMessage,
  previous?: DiscordMessage,
  options: RenderMessageOptions = {},
): string => {
  const {
    wrapperTag = "article",
    avatarTag = "div",
    bodyTag = "div",
    headerTag = "header",
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

  const articleAttributes: string[] = [`class="${articleClasses.join(" ")}"`]
  if (message.id) {
    articleAttributes.push(`data-discord-id="${escapeAttribute(message.id)}"`)
  }
  if (authorColor) {
    articleAttributes.push(`style="--discord-author-color: ${escapeAttribute(authorColor)}"`)
  }

  const avatarMarkup = showAvatar
    ? `<${avatarTag} class="discord-avatar">
        <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(displayName)}'s avatar" loading="lazy" width="40" height="40" />
      </${avatarTag}>`
    : `<${avatarTag} class="discord-avatar discord-avatar--hidden" aria-hidden="true"></${avatarTag}>`

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

  const attributes = articleAttributes.join(" ")

  return `<${wrapperTag} ${attributes}>
    ${avatarMarkup}
    <${bodyTag} class="discord-body">
      ${headerMarkup}
      <${contentTag} class="${contentClasses.join(" ")}">${content}${accessibleTimestamp}</${contentTag}>
    </${bodyTag}>
    <a class="discord-jump" href="${escapeAttribute(jumpUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open Discord message in a new tab"></a>
  </${wrapperTag}>`
}

const renderMessages = (messages: DiscordMessage[], options: RenderMessagesOptions = {}): string => {
  if (messages.length === 0) {
    return ""
  }

  const { containerTag = "section", messageOptions } = options

  const htmlMessages = messages
    .map((message, index) =>
      renderMessage(message, index > 0 ? messages[index - 1] : undefined, messageOptions),
    )
    .join("\n")
  return `<${containerTag} class="discord-thread" data-message-count="${messages.length}">
${htmlMessages}
</${containerTag}>`
}

const renderCitation = (id: string, messages: DiscordMessage[]): string | undefined => {
  const threadHtml = renderMessages(messages, {
    containerTag: "span",
    messageOptions: {
      wrapperTag: "span",
      avatarTag: "span",
      bodyTag: "span",
      headerTag: "span",
      contentTag: "span",
    },
  })
  if (!threadHtml) {
    return undefined
  }

  const count = messages.length
  const labelText = count === 1 ? "View Discord citation (1 message)" : `View Discord citation (${count} messages)`

  return `<span class="discord-cite" data-discord-id="${escapeAttribute(id)}">
    <button type="button" class="discord-cite__trigger" aria-label="${escapeAttribute(labelText)}" title="${escapeAttribute(labelText)}">
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
        <path d="M18.59 5.88997C17.36 5.31997 16.05 4.89997 14.67 4.65997C14.5 4.95997 14.3 5.36997 14.17 5.69997C12.71 5.47997 11.26 5.47997 9.83001 5.69997C9.69001 5.36997 9.49001 4.95997 9.32001 4.65997C7.94001 4.89997 6.63001 5.31997 5.40001 5.88997C2.92001 9.62997 2.25001 13.28 2.58001 16.87C4.23001 18.1 5.82001 18.84 7.39001 19.33C7.78001 18.8 8.12001 18.23 8.42001 17.64C7.85001 17.43 7.31001 17.16 6.80001 16.85C6.94001 16.75 7.07001 16.64 7.20001 16.54C10.33 18 13.72 18 16.81 16.54C16.94 16.65 17.07 16.75 17.21 16.85C16.7 17.16 16.15 17.42 15.59 17.64C15.89 18.23 16.23 18.8 16.62 19.33C18.19 18.84 19.79 18.1 21.43 16.87C21.82 12.7 20.76 9.08997 18.61 5.88997H18.59ZM8.84001 14.67C7.90001 14.67 7.13001 13.8 7.13001 12.73C7.13001 11.66 7.88001 10.79 8.84001 10.79C9.80001 10.79 10.56 11.66 10.55 12.73C10.55 13.79 9.80001 14.67 8.84001 14.67ZM15.15 14.67C14.21 14.67 13.44 13.8 13.44 12.73C13.44 11.66 14.19 10.79 15.15 10.79C16.11 10.79 16.87 11.66 16.86 12.73C16.86 13.79 16.11 14.67 15.15 14.67Z" />
      </svg>
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
    const id = match[1] ?? match[2]
    if (!id) {
      continue
    }

    if (start > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, start) })
    }

    const messages = citations.get(id) ?? []
    if (messages.length > 0) {
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

const extractCitationDataFromCallout = (node: MdParent):
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

    return { id, messages }
  } catch (error) {
    console.warn("Failed to parse Discord citation callout payload", error)
    return undefined
  }
}

const collectCitationCallouts = (root: MdNode): Map<string, DiscordMessage[]> => {
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
        const data = extractCitationDataFromCallout(child as MdParent)
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
          const citations = collectCitationCallouts(root)
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