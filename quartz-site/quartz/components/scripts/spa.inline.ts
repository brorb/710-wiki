import micromorph from "micromorph"
import { FullSlug, RelativeURL, getFullSlug, normalizeRelativeURLs } from "../../util/path"
import { fetchCanonical } from "./util"

declare global {
  interface Window {
    __quartzCleanupFns?: Set<(...args: any[]) => void>
    addCleanup: (fn: (...args: any[]) => void) => any
  }
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

  notifyNav(getFullSlug(window))
  delete announcer.dataset.persist
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
const runInitialNav = () => notifyNav(getFullSlug(window))
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
