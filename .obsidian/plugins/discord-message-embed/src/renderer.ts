import type DiscordMessageEmbedPlugin from "./main"
import type { DiscordMessageBlock, DiscordProfile } from "./types"
import { DEFAULT_AVATAR } from "./types"
import DISCORD_CSS from "./discord-thread.css"

/* ── Helpers ── */

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

const formatTimestamp = (
  source?: string,
): { readable: string; iso: string } | undefined => {
  if (!source) return undefined
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return { readable: source, iso: source }
  const dd = date.getDate().toString().padStart(2, "0")
  const mm = (date.getMonth() + 1).toString().padStart(2, "0")
  const yyyy = date.getFullYear().toString()
  const hh = date.getHours().toString().padStart(2, "0")
  const min = date.getMinutes().toString().padStart(2, "0")
  return { readable: `${dd}/${mm}/${yyyy} ${hh}:${min}`, iso: date.toISOString() }
}

interface ResolvedAuthor {
  display_name: string
  username: string
  color?: string
  avatar_url: string
}

function resolveAuthor(
  msg: DiscordMessageBlock,
  profiles: Record<string, DiscordProfile>,
): ResolvedAuthor {
  // Profile-based resolution
  if (msg.profile && profiles[msg.profile]) {
    const p = profiles[msg.profile]
    return {
      display_name: p.display_name,
      username: p.username,
      color: p.color,
      avatar_url: p.avatar_url || DEFAULT_AVATAR,
    }
  }

  // Legacy inline resolution
  return {
    display_name:
      msg.author?.display_name || msg.author?.username || "Unknown User",
    username: msg.author?.username || "unknown",
    color: msg.author?.color ?? msg.author?.colour,
    avatar_url: msg.avatar_url || DEFAULT_AVATAR,
  }
}

function getAuthorKey(msg: DiscordMessageBlock, profiles: Record<string, DiscordProfile>): string {
  if (msg.profile) return msg.profile
  const a = msg.author
  if (!a) return ""
  return `${a.username ?? ""}|${a.display_name ?? ""}`
}

/* ── Main render function ── */

export function renderDiscordThread(
  messages: DiscordMessageBlock[],
  profiles: Record<string, DiscordProfile>,
  collapsible = true,
): HTMLElement {
  const wrapper = document.createElement("div")
  wrapper.classList.add("discord-thread-wrapper")
  if (collapsible) wrapper.classList.add("collapsed")

  const content = document.createElement("div")
  content.classList.add("discord-thread-content")
  if (collapsible) content.classList.add("collapsed")

  const thread = document.createElement("section")
  thread.classList.add("discord-thread")
  thread.setAttribute("data-message-count", String(messages.length))

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = i > 0 ? messages[i - 1] : undefined
    const el = renderMessage(msg, prev, profiles)
    thread.appendChild(el)
  }

  content.appendChild(thread)

  // Fade overlay
  if (collapsible) {
    const fade = document.createElement("div")
    fade.classList.add("discord-thread-fade")
    fade.setAttribute("aria-hidden", "true")
    content.appendChild(fade)
  }

  wrapper.appendChild(content)

  // Collapse toggle
  if (collapsible) {
    const toggle = document.createElement("button")
    toggle.classList.add("discord-collapse-toggle")
    toggle.setAttribute("aria-expanded", "false")
    toggle.innerHTML = `<span>Show More</span>
      <svg class="discord-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>`

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true"
      if (expanded) {
        // Collapse
        toggle.setAttribute("aria-expanded", "false")
        content.classList.add("collapsed")
        wrapper.classList.add("collapsed")
        toggle.querySelector("span")!.textContent = "Show More"
      } else {
        // Expand
        toggle.setAttribute("aria-expanded", "true")
        content.classList.remove("collapsed")
        wrapper.classList.remove("collapsed")
        toggle.querySelector("span")!.textContent = "Show Less"
      }
    })

    wrapper.appendChild(toggle)
  }

  return wrapper
}

function renderMessage(
  msg: DiscordMessageBlock,
  prev: DiscordMessageBlock | undefined,
  profiles: Record<string, DiscordProfile>,
): HTMLElement {
  const author = resolveAuthor(msg, profiles)
  const prevKey = prev ? getAuthorKey(prev, profiles) : undefined
  const currKey = getAuthorKey(msg, profiles)
  const sameAuthor = prevKey !== undefined && prevKey === currKey && prevKey !== ""
  const timestamp = formatTimestamp(msg.timestamp)

  const article = document.createElement("article")
  article.classList.add("discord-message")
  if (sameAuthor) article.classList.add("discord-message--compact")

  if (author.color) {
    article.style.setProperty("--discord-author-color", author.color)
  }

  // Avatar
  if (!sameAuthor) {
    const avatarDiv = document.createElement("div")
    avatarDiv.classList.add("discord-avatar")
    const img = document.createElement("img")
    img.src = author.avatar_url
    img.alt = `${author.display_name}'s avatar`
    img.loading = "lazy"
    img.width = 40
    img.height = 40
    img.onerror = () => {
      img.onerror = null
      img.src = DEFAULT_AVATAR
    }
    avatarDiv.appendChild(img)
    article.appendChild(avatarDiv)
  } else {
    const spacer = document.createElement("div")
    spacer.classList.add("discord-avatar-spacer")
    spacer.setAttribute("aria-hidden", "true")
    article.appendChild(spacer)
  }

  // Body
  const body = document.createElement("div")
  body.classList.add("discord-body")

  // Header (only for first message or different author)
  if (!sameAuthor) {
    const header = document.createElement("div")
    header.classList.add("discord-header")

    const nameSpan = document.createElement("span")
    nameSpan.classList.add("discord-author")
    nameSpan.textContent = author.display_name
    if (author.color) nameSpan.style.color = author.color
    header.appendChild(nameSpan)

    if (timestamp) {
      const time = document.createElement("time")
      time.dateTime = timestamp.iso
      time.textContent = timestamp.readable
      header.appendChild(time)
    }

    body.appendChild(header)
  }

  // Content
  const contentDiv = document.createElement("div")
  contentDiv.classList.add("discord-content")
  if (sameAuthor) contentDiv.classList.add("discord-content--compact")

  // Properly render content with newlines
  const contentText = msg.content ?? ""
  // Split by newlines and create text nodes + <br> elements
  const lines = contentText.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      contentDiv.appendChild(document.createElement("br"))
    }
    contentDiv.appendChild(document.createTextNode(lines[i]))
  }

  // Add hidden timestamp for compact messages
  if (sameAuthor && timestamp) {
    const srTime = document.createElement("time")
    srTime.classList.add("discord-timestamp-sr")
    srTime.dateTime = timestamp.iso
    srTime.textContent = timestamp.readable
    srTime.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;"
    contentDiv.appendChild(srTime)
  }

  body.appendChild(contentDiv)
  article.appendChild(body)

  return article
}

/* ── Registration ── */

let styleInjected = false

export function registerDiscordRenderer(plugin: DiscordMessageEmbedPlugin) {
  plugin.registerMarkdownCodeBlockProcessor("discord", (source, el, ctx) => {
    // Inject CSS once
    if (!styleInjected) {
      const style = document.createElement("style")
      style.textContent = DISCORD_CSS
      document.head.appendChild(style)
      styleInjected = true
    }

    let messages: DiscordMessageBlock[]
    try {
      const parsed = JSON.parse(source.trim())
      messages = normaliseMessages(parsed)
    } catch {
      el.createEl("pre", { text: `Invalid discord JSON:\n${source}` })
      return
    }

    if (messages.length === 0) {
      el.createEl("p", { text: "(empty discord block)" })
      return
    }

    const thread = renderDiscordThread(
      messages,
      plugin.settings.profiles,
      messages.length > 6,
    )
    el.appendChild(thread)
  })
}

/** Normalise raw JSON into a flat array of message blocks. */
function normaliseMessages(raw: unknown): DiscordMessageBlock[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.flatMap((e) => normaliseMessages(e))
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.messages)) return normaliseMessages(obj.messages)
    return [obj as unknown as DiscordMessageBlock]
  }
  return []
}
