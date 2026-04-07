import type DiscordMessageEmbedPlugin from "./main"
import type { YouTubeChannelProfile } from "./types"
import COMMUNITY_CSS from "./community-post.css"
import { requestUrl } from "obsidian"

/* ── Helpers ── */

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const DEFAULT_CHANNEL_HANDLE = "7-10tone"

interface ParsedPost {
  channelHandle: string
  likes: number
  comments: number
  postedLabel: string
  body: string
}

/**
 * Parse the metadata line that starts the code block body.
 * Expected format (first line of source):
 *   @handle,likes,comments,date label
 * or without handle:
 *   likes,comments,date label
 * The rest of the source is the post body.
 */
function parseSource(source: string): ParsedPost | null {
  const lines = source.split(/\r?\n/)
  const firstLine = (lines[0] ?? "").trim()
  if (!firstLine) return null

  // Also support legacy format where first line starts with "community-post,"
  const metaLine = firstLine.replace(/^\s*community-post\s*,\s*/i, "")

  const parts = metaLine
    .split(",")
    .map((p) => p.trim())
    .filter((p, i, a) => !(p.length === 0 && i >= a.length - 1))

  if (parts.length < 2) return null

  let argIndex = 0
  let channelHandle = DEFAULT_CHANNEL_HANDLE

  if (parts[0] && parts[0].startsWith("@")) {
    channelHandle = parts[0].slice(1).toLowerCase()
    argIndex++
  }

  if (parts.length < argIndex + 2) return null

  const likes = Number.parseInt(parts[argIndex] ?? "", 10)
  const comments = Number.parseInt(parts[argIndex + 1] ?? "", 10)
  if (!Number.isFinite(likes) || !Number.isFinite(comments)) return null

  let postedLabelRaw = parts[argIndex + 2] ?? ""
  const extra = parts.slice(argIndex + 3).filter((s) => s.length > 0)

  // Merge year into label when split across commas (e.g. "28 July" + "2025")
  if (
    postedLabelRaw &&
    extra.length > 0 &&
    /[A-Za-z]/.test(postedLabelRaw) &&
    !/\d{4}/.test(postedLabelRaw) &&
    /^\d{4}$/.test(extra[0])
  ) {
    postedLabelRaw = `${postedLabelRaw} ${extra.shift()}`.trim()
  }

  // Numeric day + month name (e.g. "4" + "November 2025")
  if (
    (!postedLabelRaw || /^\d+$/.test(postedLabelRaw)) &&
    extra.length > 0 &&
    /[A-Za-z]/.test(extra[0])
  ) {
    postedLabelRaw = `${postedLabelRaw} ${extra.shift()}`.trim()
  }

  const body = lines.slice(1).join("\n").trim()

  return {
    channelHandle,
    likes,
    comments,
    postedLabel: postedLabelRaw,
    body,
  }
}

function formatCount(n: number): string | undefined {
  if (n <= 0) return undefined
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return String(n)
}

/* ── SVG icons (matching Quartz) ── */

const LIKE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14 1 7.59 7.41C7.22 7.78 7 8.3 7 8.83V19c0 1.1.9 2 2 2h8c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>`

const COMMENT_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12l5 4V5c0-1.1-.9-2-2-2h-3z" /></svg>`

/* ── Style injection ── */

let styleInjected = false

function injectStyle() {
  if (styleInjected) return
  const style = document.createElement("style")
  style.textContent = COMMUNITY_CSS
  document.head.appendChild(style)
  styleInjected = true
}

/* ── YouTube channel profile fetching ── */

const inflightFetches = new Map<string, Promise<YouTubeChannelProfile>>()

async function getChannelProfile(
  handle: string,
  plugin: DiscordMessageEmbedPlugin,
): Promise<YouTubeChannelProfile> {
  const key = handle.toLowerCase()
  const cached = plugin.settings.youtubeChannels[key]
  if (cached?.avatarUrl) return cached

  // De-duplicate concurrent requests for the same handle
  if (inflightFetches.has(key)) return inflightFetches.get(key)!

  const promise = fetchChannelProfile(handle).then(async (profile) => {
    plugin.settings.youtubeChannels[key] = profile
    await plugin.saveSettings()
    inflightFetches.delete(key)
    return profile
  }).catch(() => {
    inflightFetches.delete(key)
    return { name: `@${handle}`, avatarUrl: "" }
  })

  inflightFetches.set(key, promise)
  return promise
}

async function fetchChannelProfile(handle: string): Promise<YouTubeChannelProfile> {
  const resp = await requestUrl({
    url: `https://www.youtube.com/@${handle}`,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  })

  const html = resp.text
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)

  return {
    name: titleMatch?.[1] ?? `@${handle}`,
    avatarUrl: imageMatch?.[1] ?? "",
  }
}

/* ── DOM builder ── */

function buildPostElement(post: ParsedPost, channelProfile?: YouTubeChannelProfile): HTMLElement {
  const article = document.createElement("article")
  article.classList.add("yt-community-post")

  // Avatar
  const avatarSpan = document.createElement("span")
  avatarSpan.classList.add("yt-community-post__avatar")
  const avatarUrl = channelProfile?.avatarUrl
  if (avatarUrl) {
    const img = document.createElement("img")
    img.src = avatarUrl
    img.alt = channelProfile?.name ?? post.channelHandle
    img.loading = "lazy"
    img.width = 48
    img.height = 48
    avatarSpan.appendChild(img)
  } else {
    const initial = document.createElement("span")
    initial.textContent = post.channelHandle.charAt(0).toUpperCase()
    initial.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#383838;color:#ccc;font-weight:600;font-size:1.2rem;border-radius:50%;"
    avatarSpan.appendChild(initial)
  }
  article.appendChild(avatarSpan)

  // Content wrapper
  const content = document.createElement("div")
  content.classList.add("yt-community-post__content")

  // Header
  const header = document.createElement("div")
  header.classList.add("yt-community-post__header")

  const identity = document.createElement("div")
  identity.classList.add("yt-community-post__identity")

  const channel = document.createElement("span")
  channel.classList.add("yt-community-post__channel")
  channel.textContent = channelProfile?.name ?? `@${post.channelHandle}`
  identity.appendChild(channel)

  if (post.postedLabel) {
    const ts = document.createElement("span")
    ts.classList.add("yt-community-post__timestamp")
    ts.textContent = `Posted ${escapeHtml(post.postedLabel)}`
    identity.appendChild(ts)
  }

  header.appendChild(identity)
  content.appendChild(header)

  // Body
  if (post.body) {
    const body = document.createElement("div")
    body.classList.add("yt-community-post__body")

    const textDiv = document.createElement("div")
    textDiv.classList.add("yt-community-post__text")

    // Render with line breaks
    const lines = post.body.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) textDiv.appendChild(document.createElement("br"))
      textDiv.appendChild(document.createTextNode(lines[i]))
    }

    body.appendChild(textDiv)
    content.appendChild(body)
  }

  // Footer
  const footer = document.createElement("footer")
  footer.classList.add("yt-community-post__footer")

  const actions = document.createElement("div")
  actions.classList.add("yt-community-post__actions")
  actions.setAttribute("aria-hidden", "true")

  // Like action
  const likeAction = document.createElement("span")
  likeAction.classList.add("yt-community-post__action")
  likeAction.innerHTML = LIKE_SVG
  const likeCount = formatCount(post.likes)
  if (likeCount) {
    const countSpan = document.createElement("span")
    countSpan.classList.add("yt-community-post__count")
    countSpan.textContent = likeCount
    likeAction.appendChild(countSpan)
  }
  actions.appendChild(likeAction)

  // Comment action
  const commentAction = document.createElement("span")
  commentAction.classList.add("yt-community-post__action")
  commentAction.innerHTML = COMMENT_SVG
  const commentCount = formatCount(post.comments)
  if (commentCount) {
    const countSpan = document.createElement("span")
    countSpan.classList.add("yt-community-post__count")
    countSpan.textContent = commentCount
    commentAction.appendChild(countSpan)
  }
  actions.appendChild(commentAction)

  footer.appendChild(actions)
  content.appendChild(footer)

  article.appendChild(content)
  return article
}

/* ── Registration ── */

export function registerCommunityPostRenderer(plugin: DiscordMessageEmbedPlugin) {
  plugin.registerMarkdownCodeBlockProcessor("community-post", (source, el, _ctx) => {
    injectStyle()

    const post = parseSource(source)
    if (!post) {
      el.createEl("pre", { text: `Invalid community post:\n${source}` })
      return
    }

    // Render immediately with cached profile (or placeholder), then
    // upgrade to fetched profile if needed
    const cached = plugin.settings.youtubeChannels[post.channelHandle.toLowerCase()]
    const article = buildPostElement(post, cached)
    el.appendChild(article)

    if (!cached?.avatarUrl) {
      getChannelProfile(post.channelHandle, plugin).then((profile) => {
        // Re-render with fetched profile
        const updated = buildPostElement(post, profile)
        article.replaceWith(updated)
      })
    }
  })
}
