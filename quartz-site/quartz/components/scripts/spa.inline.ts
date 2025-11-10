import micromorph from "micromorph"
import { FullSlug, RelativeURL, getFullSlug, normalizeRelativeURLs } from "../../util/path"
import { fetchCanonical } from "./util"

declare global {
  interface Window {
    __quartzCleanupFns?: Set<(...args: any[]) => void>
    addCleanup: (fn: (...args: any[]) => void) => any
  }
}

type NavGuardReason = "missing-root" | "empty-center"

type MutationLogEntry = {
  ts: number
  slug: FullSlug
  pathname: string
  target: string
  added?: string[]
  removed?: string[]
  attributeName?: string
}

type NavGuardLogEntry = {
  ts: number
  slug: FullSlug
  pathname: string
  reason: NavGuardReason
}

type QuartzDiagnostics = {
  commentMountFailures: number
  lastFailure?: string
  mutationLogs?: MutationLogEntry[]
  navGuardReloads?: number
  navGuardEvents?: NavGuardLogEntry[]
}

const DIAGNOSTICS_MAX_MUTATIONS = 20
const DIAGNOSTICS_MAX_GUARD_EVENTS = 10
const MUTATION_TRACE_WINDOW_MS = 4000

const getDiagnostics = (): QuartzDiagnostics => {
  const globalWindow = window as Window & { quartzDiagnostics?: QuartzDiagnostics }
  if (!globalWindow.quartzDiagnostics) {
    globalWindow.quartzDiagnostics = { commentMountFailures: 0 }
  } else if (typeof globalWindow.quartzDiagnostics.commentMountFailures !== "number") {
    globalWindow.quartzDiagnostics.commentMountFailures = 0
  }
  return globalWindow.quartzDiagnostics
}

const pushLimited = <T>(list: T[], entry: T, maxEntries: number) => {
  list.push(entry)
  if (list.length > maxEntries) {
    list.splice(0, list.length - maxEntries)
  }
}

const describeNode = (node: Node): string => {
  if (node instanceof Element) {
    const id = node.id ? `#${node.id}` : ""
    const classList = node.classList.length > 0 ? `.${[...node.classList].join(".")}` : ""
    return `${node.tagName.toLowerCase()}${id}${classList}`
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? ""
    return text.length > 16 ? `#text(${text.slice(0, 16)}…)` : `#text(${text})`
  }

  return node.nodeName.toLowerCase()
}

const summarizeNodes = (nodes: NodeList | Node[], maxSummary: number = 3): string[] => {
  const result: string[] = []
  const nodeArray = Array.isArray(nodes) ? nodes : Array.from(nodes)
  for (const node of nodeArray) {
    if (result.length >= maxSummary) {
      break
    }
    result.push(describeNode(node))
  }
  const remaining = nodeArray.length - result.length
  if (remaining > 0) {
    result.push(`(+${remaining} more)`)
  }
  return result
}

const isSuspiciousElement = (element: Element): boolean => {
  const id = element.id.toLowerCase()
  if (id.includes("popover") || id.includes("lean") || id.includes("library")) {
    return true
  }

  for (const cls of element.classList) {
    const lower = cls.toLowerCase()
    if (lower.includes("popover") || lower.includes("lean") || lower.includes("library")) {
      return true
    }
  }

  return false
}

const shouldLogMutation = (mutation: MutationRecord): boolean => {
  if (mutation.type !== "childList") {
    return false
  }

  if (mutation.removedNodes.length > 0) {
    return true
  }

  return Array.from(mutation.addedNodes).some((node) => node instanceof Element && isSuspiciousElement(node))
}

let mutationObserver: MutationObserver | null = null
let mutationTraceTimeout: number | undefined
let mutationContext: { slug: FullSlug; pathname: string } | null = null

const recordMutationEntry = (mutation: MutationRecord) => {
  if (!mutationContext) {
    mutationContext = { slug: getFullSlug(window), pathname: window.location.pathname }
  }

  const diagnostics = getDiagnostics()
  const entry: MutationLogEntry = {
    ts: Date.now(),
    slug: mutationContext.slug,
    pathname: mutationContext.pathname,
    target: describeNode(mutation.target),
  }

  if (mutation.type === "childList") {
    if (mutation.addedNodes.length > 0) {
      entry.added = summarizeNodes(mutation.addedNodes)
    }
    if (mutation.removedNodes.length > 0) {
      entry.removed = summarizeNodes(mutation.removedNodes)
    }
  } else if (mutation.type === "attributes") {
    entry.attributeName = mutation.attributeName ?? undefined
  }

  diagnostics.mutationLogs = diagnostics.mutationLogs ?? []
  pushLimited(diagnostics.mutationLogs, entry, DIAGNOSTICS_MAX_MUTATIONS)
  console.debug("[quartz] mutation traced", entry)
}

const stopMutationTrace = () => {
  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }
  if (mutationTraceTimeout !== undefined) {
    window.clearTimeout(mutationTraceTimeout)
    mutationTraceTimeout = undefined
  }
  mutationContext = null
}

const startMutationTrace = (slug: FullSlug) => {
  stopMutationTrace()
  mutationContext = { slug, pathname: window.location.pathname }
  if (!document.body) {
    return
  }

  mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (shouldLogMutation(mutation)) {
        recordMutationEntry(mutation)
      }
    }
  })

  mutationObserver.observe(document.body, { childList: true, subtree: true })
  mutationTraceTimeout = window.setTimeout(() => stopMutationTrace(), MUTATION_TRACE_WINDOW_MS)
}

const recordNavGuard = (reason: NavGuardReason) => {
  const diagnostics = getDiagnostics()
  diagnostics.navGuardReloads = (diagnostics.navGuardReloads ?? 0) + 1
  const entry: NavGuardLogEntry = {
    ts: Date.now(),
    slug: getFullSlug(window),
    pathname: window.location.pathname,
    reason,
  }
  diagnostics.navGuardEvents = diagnostics.navGuardEvents ?? []
  pushLimited(diagnostics.navGuardEvents, entry, DIAGNOSTICS_MAX_GUARD_EVENTS)
  console.warn("[quartz] SPA guard triggered", entry)
  stopMutationTrace()
}

// adapted from `micromorph`
// https://github.com/natemoo-re/micromorph
const NODE_TYPE_ELEMENT = 1
let announcer = document.createElement("route-announcer")
const isElement = (target: EventTarget | null): target is Element =>
  (target as Node)?.nodeType === NODE_TYPE_ELEMENT
const isLocalUrl = (href: string) => {
  try {
    const url = new URL(href)
    if (window.location.origin === url.origin) {
      return true
    }
  } catch (e) {}
  return false
}

const isSamePage = (url: URL): boolean => {
  const sameOrigin = url.origin === window.location.origin
  const samePath = url.pathname === window.location.pathname
  return sameOrigin && samePath
}

const getOpts = ({ target }: Event): { url: URL; scroll?: boolean } | undefined => {
  if (!isElement(target)) return
  if (target.attributes.getNamedItem("target")?.value === "_blank") return
  const a = target.closest("a")
  if (!a) return
  if ("routerIgnore" in a.dataset) return
  const { href } = a
  if (!isLocalUrl(href)) return
  return { url: new URL(href), scroll: "routerNoscroll" in a.dataset ? false : undefined }
}

function notifyNav(url: FullSlug) {
  const event: CustomEventMap["nav"] = new CustomEvent("nav", { detail: { url } })
  document.dispatchEvent(event)
}

const cleanupFns: Set<(...args: any[]) => void> = window.__quartzCleanupFns ?? new Set()
window.__quartzCleanupFns = cleanupFns
window.addCleanup = (fn) => cleanupFns.add(fn)

const HASH_SCROLL_TOLERANCE_PX = 2
const HASH_SCROLL_RETRY_DELAY_MS = 120
const HASH_SCROLL_MAX_ATTEMPTS = 8

let hashScrollTimeout: number | undefined
let hashScrollFrame: number | undefined
let hashResizeObserver: ResizeObserver | undefined
let hashTargetId: string | null = null
let hashAlignmentAttempts = 0

const clearHashScrollTimers = () => {
  if (hashScrollTimeout !== undefined) {
    window.clearTimeout(hashScrollTimeout)
    hashScrollTimeout = undefined
  }
  if (hashScrollFrame !== undefined) {
    window.cancelAnimationFrame(hashScrollFrame)
    hashScrollFrame = undefined
  }
}

const resetHashScrollState = () => {
  clearHashScrollTimers()
  if (hashResizeObserver) {
    hashResizeObserver.disconnect()
    hashResizeObserver = undefined
  }
  hashTargetId = null
  hashAlignmentAttempts = 0
}

const computeHashTargetOffset = (target: HTMLElement): number => {
  const styles = window.getComputedStyle(target)
  const marginTop = Number.parseFloat(styles.scrollMarginTop) || 0
  return target.getBoundingClientRect().top - marginTop
}

const evaluateHashTarget = (target: HTMLElement, behavior: ScrollBehavior, resetAttempts: boolean) => {
  if (resetAttempts) {
    hashAlignmentAttempts = 0
  }

  clearHashScrollTimers()
  target.scrollIntoView({ behavior, block: "start", inline: "nearest" })

  hashScrollFrame = window.requestAnimationFrame(() => {
    hashScrollFrame = undefined
    const offset = computeHashTargetOffset(target)

    if (Math.abs(offset) <= HASH_SCROLL_TOLERANCE_PX) {
      hashAlignmentAttempts = 0
      return
    }

    if (hashAlignmentAttempts >= HASH_SCROLL_MAX_ATTEMPTS) {
      resetHashScrollState()
      return
    }

    hashAlignmentAttempts += 1
    hashScrollTimeout = window.setTimeout(() => {
      hashScrollTimeout = undefined
      evaluateHashTarget(target, "auto", false)
    }, HASH_SCROLL_RETRY_DELAY_MS)
  })
}

const scrollToHashTarget = (hash: string, behavior: ScrollBehavior = "smooth"): boolean => {
  const id = decodeURIComponent(hash.startsWith("#") ? hash.substring(1) : hash)
  if (!id) {
    return false
  }

  const target = document.getElementById(id)
  if (!target) {
    return false
  }

  resetHashScrollState()
  hashTargetId = id

  evaluateHashTarget(target, behavior, true)

  if (typeof ResizeObserver !== "undefined") {
    hashResizeObserver = new ResizeObserver((entries) => {
      if (!hashTargetId) {
        return
      }

      for (const entry of entries) {
        if (entry.target === target && hashTargetId === id) {
          evaluateHashTarget(target, "auto", true)
          break
        }
      }
    })

    hashResizeObserver.observe(target)
  }

  return true
}

function startLoading() {
  const loadingBar = document.createElement("div")
  loadingBar.className = "navigation-progress"
  loadingBar.style.width = "0"
  if (!document.body.contains(loadingBar)) {
    document.body.appendChild(loadingBar)
  }

  setTimeout(() => {
    loadingBar.style.width = "80%"
  }, 100)
}

let isNavigating = false
let p: DOMParser
async function _navigate(url: URL, isBack: boolean = false) {
  isNavigating = true
  stopMutationTrace()
  startLoading()
  p = p || new DOMParser()
  const contents = await fetchCanonical(url)
    .then((res) => {
      const contentType = res.headers.get("content-type")
      if (contentType?.startsWith("text/html")) {
        return res.text()
      } else {
        window.location.assign(url)
      }
    })
    .catch(() => {
      window.location.assign(url)
    })

  if (!contents) return

  // notify about to nav
  const event: CustomEventMap["prenav"] = new CustomEvent("prenav", { detail: {} })
  document.dispatchEvent(event)

  // cleanup old
  cleanupFns.forEach((fn) => fn())
  cleanupFns.clear()

  const html = p.parseFromString(contents, "text/html")
  normalizeRelativeURLs(html, url)

  let title = html.querySelector("title")?.textContent
  if (title) {
    document.title = title
  } else {
    const h1 = document.querySelector("h1")
    title = h1?.innerText ?? h1?.textContent ?? url.pathname
  }
  if (announcer.textContent !== title) {
    announcer.textContent = title
  }
  announcer.dataset.persist = ""
  html.body.appendChild(announcer)

  // morph body
  try {
    await micromorph(document.body, html.body)
  } catch (err) {
    console.error("Quartz SPA navigation failed during DOM diff", err)
    window.location.assign(url)
    return
  }

  // scroll into place and add history
  if (!isBack) {
    if (url.hash) {
      if (!scrollToHashTarget(url.hash, "smooth")) {
        resetHashScrollState()
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
      }
    } else {
      resetHashScrollState()
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
    }
  } else if (!url.hash) {
    resetHashScrollState()
  }

  // now, patch head, re-executing scripts
  const elementsToRemove = document.head.querySelectorAll(":not([spa-preserve])")
  elementsToRemove.forEach((el) => el.remove())
  const elementsToAdd = html.head.querySelectorAll(":not([spa-preserve])")
  elementsToAdd.forEach((el) => document.head.appendChild(el))

  // delay setting the url until now
  // at this point everything is loaded so changing the url should resolve to the correct addresses
  if (!isBack) {
    history.pushState({}, "", url)
  }

  const slug = getFullSlug(window)
  notifyNav(slug)
  startMutationTrace(slug)
  delete announcer.dataset.persist

  queueMicrotask(verifyVisibleContent)
}

async function navigate(url: URL, isBack: boolean = false) {
  if (isNavigating) return
  isNavigating = true
  try {
    await _navigate(url, isBack)
  } catch (e) {
    console.error(e)
    window.location.assign(url)
  } finally {
    isNavigating = false
  }
}

window.spaNavigate = navigate

function createRouter() {
  if (typeof window !== "undefined") {
    window.addEventListener("click", async (event) => {
      const { url } = getOpts(event) ?? {}
      // dont hijack behaviour, just let browser act normally
      if (!url || event.ctrlKey || event.metaKey) return
      event.preventDefault()

      if (isSamePage(url) && url.hash) {
        scrollToHashTarget(url.hash, "smooth")
        history.pushState({}, "", url)
        return
      }

      navigate(url, false)
    })

    window.addEventListener("popstate", (event) => {
      const { url } = getOpts(event) ?? {}
      if (window.location.hash && window.location.pathname === url?.pathname) return
      navigate(new URL(window.location.toString()), true)
      return
    })
  }

  return new (class Router {
    go(pathname: RelativeURL) {
      const url = new URL(pathname, window.location.toString())
      return navigate(url, false)
    }

    back() {
      return window.history.back()
    }

    forward() {
      return window.history.forward()
    }
  })()
}

createRouter()

window.addEventListener("load", () => {
  if (window.location.hash) {
    scrollToHashTarget(window.location.hash, "auto")
  } else {
    resetHashScrollState()
  }
})

window.addEventListener("hashchange", () => {
  if (window.location.hash) {
    scrollToHashTarget(window.location.hash, "auto")
  } else {
    resetHashScrollState()
  }
})

// Defer the initial nav notification so component scripts have time to
// register their `nav` listeners during the rest of the bundle execution.
const runInitialNav = () => {
  const slug = getFullSlug(window)
  notifyNav(slug)
  startMutationTrace(slug)
}
if (typeof queueMicrotask === "function") {
  queueMicrotask(runInitialNav)
} else {
  Promise.resolve().then(runInitialNav)
}

if (!customElements.get("route-announcer")) {
  const attrs = {
    "aria-live": "assertive",
    "aria-atomic": "true",
    style:
      "position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px",
  }

  customElements.define(
    "route-announcer",
    class RouteAnnouncer extends HTMLElement {
      constructor() {
        super()
      }
      connectedCallback() {
        for (const [key, value] of Object.entries(attrs)) {
          this.setAttribute(key, value)
        }
      }
    },
  )
}

const verifyVisibleContent = () => {
  const root = document.getElementById("quartz-root")
  if (!root) {
    recordNavGuard("missing-root")
    window.location.assign(window.location.href)
    return
  }

  const primaryColumn = root.querySelector(".center")
  const hasVisibleContent =
    !!primaryColumn && primaryColumn.childElementCount > 0 && primaryColumn.textContent?.trim().length !== 0

  if (!hasVisibleContent) {
    recordNavGuard("empty-center")
    window.location.assign(window.location.href)
  }
}
