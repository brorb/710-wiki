const DISCORD_WIDGET_SELECTOR = ".discord-widget"
const MEMBER_COUNT_SELECTOR = "[data-discord-member-count]"
const GUILD_ID = "1389902002737250314"
const WIDGET_ENDPOINT = `https://discord.com/api/guilds/${GUILD_ID}/widget.json`
const FETCH_TIMEOUT = 6_000

const fetchWithTimeout = async (resource: RequestInfo | URL, options: RequestInit = {}) => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    })
    return response
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const updateDiscordMemberCounts = async () => {
  try {
    const response = await fetchWithTimeout(WIDGET_ENDPOINT)
    if (!response?.ok) {
      return
    }

    const payload = (await response.json()) as {
      presence_count?: number
      members?: Array<unknown>
    }

    const count = Number.isFinite(payload?.presence_count)
      ? payload.presence_count
      : Array.isArray(payload?.members)
        ? payload.members.length
        : undefined

    if (!Number.isFinite(count)) {
      return
    }

    const formatter = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    })

    const textValue = formatter.format(count as number)
    const widgets = document.querySelectorAll(DISCORD_WIDGET_SELECTOR)

    widgets.forEach((widget) => {
      const badge = widget.querySelector<HTMLElement>(MEMBER_COUNT_SELECTOR)
      if (!badge) {
        return
      }

      badge.textContent = textValue
      badge.setAttribute("data-ready", "true")
      badge.setAttribute("aria-label", `${textValue} members currently online`)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return
    }

    console.warn("Failed to update Discord member counts", error)
  }
}

const bootstrapDiscordWidget = () => {
  updateDiscordMemberCounts()

  document.addEventListener("nav", () => {
    updateDiscordMemberCounts()
  })
}

bootstrapDiscordWidget()
