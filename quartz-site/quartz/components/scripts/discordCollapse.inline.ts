const setupDiscordToggles = () => {
  const toggles = document.querySelectorAll(".discord-collapse-toggle")

  toggles.forEach((toggle) => {
    if (toggle.hasAttribute("data-discord-initialized")) {
      return
    }

    toggle.setAttribute("data-discord-initialized", "true")

    const toggleId = toggle.getAttribute("data-discord-toggle")
    if (!toggleId) return

    const contentId = `${toggleId}-content`
    const content = document.getElementById(contentId)
    if (!content) return

    const threadElement = content.querySelector(".discord-thread")
    if (!threadElement) return

  const wrapper = content.closest(".discord-thread-wrapper") as HTMLElement | null
  const toggleButton = toggle as HTMLElement
  const contentElement = content as HTMLElement
  const COLLAPSED_HEIGHT = 252
  const MINIMUM_EXCESS = 80

    const applyWrapperState = (isCollapsed: boolean) => {
      if (!wrapper) return
      wrapper.classList.toggle("collapsed", isCollapsed)
    }

    const setToggleState = (expanded: boolean) => {
      toggleButton.setAttribute("aria-expanded", expanded ? "true" : "false")
      toggleButton.classList.toggle("is-expanded", expanded)
      const toggleText = toggleButton.querySelector("span")
      if (toggleText) {
        toggleText.textContent = expanded ? "Show Less" : "Show More"
      }
    }

    // Check if content is taller than collapsed height
    const checkHeight = () => {
      const fullHeight = threadElement.scrollHeight
      const excess = fullHeight - COLLAPSED_HEIGHT
      const collapseNeeded = fullHeight > COLLAPSED_HEIGHT && excess >= MINIMUM_EXCESS

      if (!collapseNeeded) {
        toggleButton.style.display = "none"
        contentElement.classList.remove("collapsed")
        contentElement.style.maxHeight = "none"
        applyWrapperState(false)
        setToggleState(true)
      } else {
        toggleButton.style.display = "flex"
        const isCollapsed = contentElement.classList.contains("collapsed")
        applyWrapperState(isCollapsed)
        setToggleState(!isCollapsed)
        if (isCollapsed) {
          contentElement.style.maxHeight = `${COLLAPSED_HEIGHT}px`
        } else {
          contentElement.style.maxHeight = "none"
        }
      }
    }

    // Initial check
    checkHeight()

    // Handle toggle click
    toggle.addEventListener("click", () => {
      const isCollapsed = contentElement.classList.contains("collapsed")

      if (isCollapsed) {
        contentElement.classList.remove("collapsed")
  contentElement.style.maxHeight = `${threadElement.scrollHeight}px`
        applyWrapperState(false)
        setToggleState(true)

        // Force reflow to ensure smooth animation on first expand
        void contentElement.offsetHeight
        window.setTimeout(() => {
          if (!contentElement.classList.contains("collapsed")) {
            contentElement.style.maxHeight = "none"
          }
        }, 400)
      } else {
        contentElement.classList.add("collapsed")
        contentElement.style.maxHeight = `${COLLAPSED_HEIGHT}px`
        applyWrapperState(true)
        setToggleState(false)
      }
    })

    // Re-check on window resize
    const resizeObserver = new ResizeObserver(() => {
      checkHeight()
    })

    resizeObserver.observe(threadElement)

    window.addCleanup?.(() => {
      resizeObserver.disconnect()
    })
  })
}

const initialiseDiscordToggles = () => {
  setupDiscordToggles()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialiseDiscordToggles, { once: true })
} else {
  initialiseDiscordToggles()
}

document.addEventListener("nav", initialiseDiscordToggles)
