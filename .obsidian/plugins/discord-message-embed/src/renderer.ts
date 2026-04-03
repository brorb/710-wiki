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

function injectStyle() {
  if (styleInjected) return
  const style = document.createElement("style")
  style.textContent = DISCORD_CSS
  document.head.appendChild(style)
  styleInjected = true
}

export function registerDiscordRenderer(plugin: DiscordMessageEmbedPlugin) {
  // ── ```discord code block renderer ──
  plugin.registerMarkdownCodeBlockProcessor("discord", (source, el, ctx) => {
    injectStyle()

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

  // ── [!discord-cite] callout post-processor ──
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const callouts = el.querySelectorAll<HTMLElement>(
      '.callout[data-callout="discord-cite"]',
    )
    if (callouts.length === 0) return

    injectStyle()

    for (const callout of Array.from(callouts)) {
      // Find the JSON code block inside the callout
      const codeBlock = callout.querySelector("pre code")
      if (!codeBlock) continue

      const jsonText = codeBlock.textContent?.trim()
      if (!jsonText) continue

      let messages: DiscordMessageBlock[]
      try {
        const parsed = JSON.parse(jsonText)
        messages = normaliseMessages(parsed)
      } catch {
        continue // leave the callout as-is if JSON is invalid
      }

      if (messages.length === 0) continue

      // Replace the callout content with rendered Discord thread
      const thread = renderDiscordThread(
        messages,
        plugin.settings.profiles,
        messages.length > 6,
      )

      // Build a nice wrapper that preserves the expandable title bar
      const titleBar = callout.querySelector<HTMLElement>(
        ".callout-title",
      )
      const titleText = titleBar?.querySelector<HTMLElement>(
        ".callout-title-inner",
      )

      // Update title styling
      if (titleText) {
        const count = messages.length
        titleText.textContent = `Discord citation (${count} message${count !== 1 ? "s" : ""})`
      }

      // Add Discord icon to the title
      if (titleBar) {
        const icon = titleBar.querySelector(".callout-icon")
        if (icon) {
          icon.innerHTML = `<svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor" style="vertical-align: middle;">
            <path d="M26.963 0.875 C25.282 0.094 23.478-0.432 21.602-0.667a0.12 0.12 0 00-0.127 0.06c-0.258 0.459-0.543 1.058-0.743 1.529a23.584 23.584 0 00-7.074 0 16.326 16.326 0 00-0.754-1.53A0.125 0.125 0 0012.777-0.667C10.9-0.431 9.098 0.095 7.416 0.876a0.113 0.113 0 00-0.052 0.044C3.68 6.184 2.618 11.344 3.14 16.44a0.133 0.133 0 000.063 0.091c2.636 1.936 5.19 3.113 7.693 3.89a0.126 0.126 0 000.137-0.045c0.593-0.81 1.121-1.664 1.575-2.56a0.123 0.123 0 00-0.068-0.172c-0.839-0.318-1.639-0.707-2.407-1.15a0.125 0.125 0 01-0.012-0.207c0.162-0.121 0.323-0.248 0.478-0.375a0.12 0.12 0 010.128-0.017c5.05 2.306 10.515 2.306 15.51 0a0.12 0.12 0 010.13 0.015c0.155 0.128 0.316 0.256 0.479 0.377a0.125 0.125 0 01-0.011 0.207c-0.768 0.449-1.568 0.838-2.408 1.149a0.124 0.124 0 00-0.066 0.173c0.462 0.895 0.99 1.749 1.574 2.559a0.124 0.124 0 000.136 0.046c2.514-0.778 5.068-1.955 7.705-3.891a0.126 0.126 0 000.062-0.089c0.626-6.466-1.049-12.082-4.44-17.054a0.099 0.099 0 00-0.05-0.046zM11.44 13.532c-1.477 0-2.694-1.356-2.694-3.023s1.193-3.023 2.694-3.023c1.512 0 2.718 1.368 2.694 3.023 0 1.667-1.194 3.023-2.694 3.023zm9.96 0c-1.477 0-2.694-1.356-2.694-3.023s1.193-3.023 2.694-3.023c1.512 0 2.718 1.368 2.694 3.023 0 1.667-1.182 3.023-2.694 3.023z"/>
          </svg>`
        }
      }

      // Replace the callout body with the rendered thread
      const body = callout.querySelector<HTMLElement>(".callout-content")
      if (body) {
        body.empty()
        body.appendChild(thread)
        body.style.padding = "0"
      }

      // Style the callout itself to match Discord theme
      callout.style.backgroundColor = "#2b2d31"
      callout.style.borderColor = "#1f2024"
      callout.style.borderRadius = "12px"
      callout.style.overflow = "hidden"

      if (titleBar) {
        titleBar.style.backgroundColor = "#1f2024"
        titleBar.style.color = "#b5bac1"
      }
    }
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
