const indicatorRegistry = new Map<HTMLElement, { indicator: HTMLElement; container: HTMLElement }>()

const updateIndicatorForList = (list: HTMLElement) => {
  const entry = indicatorRegistry.get(list)
  if (!entry) {
    return
  }

  const { indicator, container } = entry
  if (list.classList.contains("collapsed")) {
    indicator.style.opacity = "0"
    return
  }

  const activeLinks = Array.from(list.querySelectorAll<HTMLAnchorElement>("a.in-view"))
  const fallbackLinks = activeLinks.length > 0 ? activeLinks : Array.from(list.querySelectorAll<HTMLAnchorElement>("a"))
  const targetLink = fallbackLinks[fallbackLinks.length - 1]
  if (!targetLink) {
    indicator.style.opacity = "0"
    return
  }

  const linkRect = targetLink.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const indicatorHeight = indicator.offsetHeight || 0
  const rawOffset = linkRect.top - containerRect.top + linkRect.height / 2 - indicatorHeight / 2
  const maxOffset = Math.max(0, container.clientHeight - indicatorHeight)
  const clampedOffset = Math.max(0, Math.min(maxOffset, rawOffset))

  indicator.style.opacity = "1"
  indicator.style.transform = `translateY(${clampedOffset}px)`
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const slug = entry.target.id
    const tocEntryElements = document.querySelectorAll(`a[data-for="${slug}"]`)
    const windowHeight = entry.rootBounds?.height
    if (windowHeight && tocEntryElements.length > 0) {
      if (entry.boundingClientRect.y < windowHeight) {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.add("in-view"))
      } else {
        tocEntryElements.forEach((tocEntryElement) => tocEntryElement.classList.remove("in-view"))
      }
    }
  }

  indicatorRegistry.forEach((_, list) => updateIndicatorForList(list))
})

function toggleToc(this: HTMLElement) {
  const container = this.closest(".toc-container") as HTMLElement | null
  const content = container?.querySelector(".toc-content") as HTMLElement | null
  if (!container || !content) {
    return
  }

  const collapsing = !this.classList.contains("collapsed")
  this.classList.toggle("collapsed", collapsing)

  const expanded = !collapsing
  this.setAttribute("aria-expanded", expanded ? "true" : "false")

  content.classList.toggle("collapsed", collapsing)
  content.setAttribute("aria-expanded", expanded ? "true" : "false")

  const indicator = container.querySelector(".toc-scroll-indicator") as HTMLElement | null
  if (indicator) {
    if (collapsing) {
      indicator.style.opacity = "0"
    } else {
      updateIndicatorForList(content)
    }
  }
}

function setupToc() {
  indicatorRegistry.clear()

  for (const toc of document.getElementsByClassName("toc")) {
    const button = toc.querySelector(".toc-header")
    const content = toc.querySelector(".toc-content")
    const container = toc.querySelector(".toc-container") as HTMLElement | null
    const indicator = container?.querySelector(".toc-scroll-indicator") as HTMLElement | null
    if (!button || !content) {
      continue
    }
    button.addEventListener("click", toggleToc)
    window.addCleanup(() => button.removeEventListener("click", toggleToc))

    if (indicator && container && content instanceof HTMLElement) {
      indicatorRegistry.set(content as HTMLElement, { indicator, container })
      content.setAttribute(
        "aria-expanded",
        content.classList.contains("collapsed") ? "false" : "true",
      )
      if (content.classList.contains("collapsed")) {
        indicator.style.opacity = "0"
      } else {
        window.requestAnimationFrame(() => updateIndicatorForList(content))
      }
    }
  }
}

document.addEventListener("nav", () => {
  setupToc()

  // update toc entry highlighting
  observer.disconnect()
  const headers = document.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")
  headers.forEach((header) => observer.observe(header))

  const handleResize = () => {
    indicatorRegistry.forEach((_, list) => updateIndicatorForList(list))
  }

  window.addEventListener("resize", handleResize)
  window.addCleanup(() => window.removeEventListener("resize", handleResize))
})
