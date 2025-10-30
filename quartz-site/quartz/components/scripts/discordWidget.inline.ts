const DISCORD_WIDGET_SELECTOR = ".discord-widget"
const MEMBER_COUNT_SELECTOR = "[data-discord-member-count]"
const GUILD_ID = "1389902002737250314"
const WIDGET_ENDPOINT = `https://discord.com/api/guilds/${GUILD_ID}/widget.json`
const FETCH_TIMEOUT = 6_000

const DEFAULT_WIDGET_HEIGHT = 500
const DEFAULT_TOP_BAND_HOLD_STOP = 0.098
const DEFAULT_TOP_BAND_TRANSITION_STOP = 0.271
const DEFAULT_TOP_BAND_TARGET_PX = DEFAULT_TOP_BAND_TRANSITION_STOP * DEFAULT_WIDGET_HEIGHT
const DEFAULT_HOLD_PROPORTION = DEFAULT_TOP_BAND_HOLD_STOP / DEFAULT_TOP_BAND_TRANSITION_STOP
const MIN_TRANSITION_STOP = 0.16
const MAX_TRANSITION_STOP = 0.78
const HOLD_BUFFER = 0.02

const gradientObservers = new WeakMap<HTMLElement, ResizeObserver>()
const pendingGradientUpdates = new WeakMap<HTMLElement, number>()
let fallbackResizeHandlerAttached = false
let fallbackResizeFrame: number | undefined

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const buildTopBandGradientData = (holdStop: number, transitionStop: number) => {
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='1' height='1'>
  <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0' stop-color='white' stop-opacity='1'/>
    <stop offset='${holdStop}' stop-color='white' stop-opacity='1'/>
    <stop offset='${transitionStop}' stop-color='black' stop-opacity='0'/>
    <stop offset='1' stop-color='black' stop-opacity='0'/>
  </linearGradient>
  <rect width='1' height='1' fill='url(#g)'/>
</svg>`.trim()

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

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

const resolveTopBandStops = (widget: HTMLElement, height: number) => {
  const dataset = widget.dataset
  const holdStopValue = Number.parseFloat(dataset.topBandHoldStop ?? "")
  const transitionStopValue = Number.parseFloat(dataset.topBandTransitionStop ?? "")
  const targetPxValue = Number.parseFloat(dataset.topBandTargetPx ?? "")

  const baseTransitionStop = Number.isFinite(transitionStopValue) && transitionStopValue > 0
    ? transitionStopValue
    : DEFAULT_TOP_BAND_TRANSITION_STOP

  const baseHoldStop = Number.isFinite(holdStopValue) && holdStopValue > 0
    ? holdStopValue
    : DEFAULT_TOP_BAND_HOLD_STOP

  const targetPx = Number.isFinite(targetPxValue) && targetPxValue > 0
    ? targetPxValue
    : DEFAULT_TOP_BAND_TARGET_PX

  const holdProportion = clamp(baseHoldStop / baseTransitionStop, HOLD_BUFFER, 0.95) || DEFAULT_HOLD_PROPORTION

  const transitionStop = clamp(targetPx / height, MIN_TRANSITION_STOP, MAX_TRANSITION_STOP)
  const holdTargetPx = targetPx * holdProportion
  const rawHoldStop = holdTargetPx / height
  const maxHoldStop = Math.max(transitionStop - HOLD_BUFFER, HOLD_BUFFER)
  const holdStop = clamp(rawHoldStop || transitionStop * DEFAULT_HOLD_PROPORTION, HOLD_BUFFER, maxHoldStop)

  if (!Number.isFinite(holdStop) || !Number.isFinite(transitionStop)) {
    return null
  }

  return { holdStop, transitionStop }
}

const updateWidgetGradient = (widget: HTMLElement): boolean => {
  const iframe = widget.querySelector<HTMLIFrameElement>("iframe")
  if (!iframe) {
    return false
  }

  const rect = iframe.getBoundingClientRect()
  const height = Math.max(iframe.offsetHeight, iframe.clientHeight, rect.height)
  if (!height) {
    return false
  }

  const stops = resolveTopBandStops(widget, height)
  if (!stops) {
    return false
  }

  const { holdStop, transitionStop } = stops

  const filterId = widget.dataset.filterId
  if (!filterId) {
    return false
  }

  const filter = document.getElementById(filterId) as SVGFilterElement | null
  if (!filter) {
    return false
  }

  const image = filter.querySelector<SVGFEImageElement>("feImage")
  if (!image) {
    return false
  }

  const gradientData = buildTopBandGradientData(holdStop, transitionStop)
  if (image.getAttribute("href") === gradientData) {
    return true
  }

  image.setAttribute("href", gradientData)
  image.setAttributeNS("http://www.w3.org/1999/xlink", "href", gradientData)

  return true
}

const scheduleWidgetGradientUpdate = (widget: HTMLElement) => {
  if (pendingGradientUpdates.has(widget)) {
    return
  }

  const frameId = window.requestAnimationFrame(() => {
    pendingGradientUpdates.delete(widget)
    if (updateWidgetGradient(widget)) {
      widget.setAttribute("data-gradient-ready", "true")
    }
  })

  pendingGradientUpdates.set(widget, frameId)
}

const attachFallbackResize = () => {
  if (fallbackResizeHandlerAttached) {
    return
  }

  fallbackResizeHandlerAttached = true

  const handleResize = () => {
    if (fallbackResizeFrame !== undefined) {
      window.cancelAnimationFrame(fallbackResizeFrame)
    }

    fallbackResizeFrame = window.requestAnimationFrame(() => {
      fallbackResizeFrame = undefined
      document
        .querySelectorAll<HTMLElement>(DISCORD_WIDGET_SELECTOR)
        .forEach((widget) => scheduleWidgetGradientUpdate(widget))
    })
  }

  window.addEventListener("resize", handleResize)
  window.addCleanup(() => {
    window.removeEventListener("resize", handleResize)
    fallbackResizeHandlerAttached = false
    if (fallbackResizeFrame !== undefined) {
      window.cancelAnimationFrame(fallbackResizeFrame)
      fallbackResizeFrame = undefined
    }
  })
}

const attachGradientObserver = (widget: HTMLElement) => {
  if (gradientObservers.has(widget)) {
    return
  }

  if (typeof ResizeObserver === "undefined") {
    attachFallbackResize()
    return
  }

  const observer = new ResizeObserver(() => {
    scheduleWidgetGradientUpdate(widget)
  })

  const iframe = widget.querySelector<HTMLIFrameElement>("iframe")
  if (iframe) {
    observer.observe(iframe)
  } else {
    observer.observe(widget)
  }

  gradientObservers.set(widget, observer)

  window.addCleanup(() => {
    observer.disconnect()
    gradientObservers.delete(widget)
  })
}

const hydrateWidget = (widget: HTMLElement) => {
  if (updateWidgetGradient(widget)) {
    widget.setAttribute("data-gradient-ready", "true")
  } else {
    scheduleWidgetGradientUpdate(widget)
  }

  attachGradientObserver(widget)

  window.addCleanup(() => {
    const frameId = pendingGradientUpdates.get(widget)
    if (frameId !== undefined) {
      window.cancelAnimationFrame(frameId)
      pendingGradientUpdates.delete(widget)
    }
  })
}

const hydrateDiscordWidgets = () => {
  const widgets = document.querySelectorAll<HTMLElement>(DISCORD_WIDGET_SELECTOR)
  widgets.forEach((widget) => hydrateWidget(widget))
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

const initDiscordWidgets = () => {
  hydrateDiscordWidgets()
  updateDiscordMemberCounts()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDiscordWidgets, { once: true })
} else {
  initDiscordWidgets()
}

document.addEventListener("nav", initDiscordWidgets)
