document.addEventListener("nav", () => {
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
  const collapsedHeight = 420

      const applyWrapperState = (isCollapsed: boolean) => {
        if (!wrapper) return
        if (isCollapsed) {
          wrapper.classList.add("collapsed")
          wrapper.style.maxHeight = `${collapsedHeight}px`
        } else {
          wrapper.classList.remove("collapsed")
          wrapper.style.removeProperty("max-height")
        }
      }
      
      // Check if content is taller than collapsed height
      const checkHeight = () => {
  const fullHeight = threadElement.scrollHeight
        
        if (fullHeight <= collapsedHeight) {
          (toggle as HTMLElement).style.display = "none"
          content.classList.remove("collapsed")
          ;(content as HTMLElement).style.maxHeight = "none"
          applyWrapperState(false)
        } else {
          (toggle as HTMLElement).style.display = "flex"
          const isCollapsed = content.classList.contains("collapsed")
          applyWrapperState(isCollapsed)
        }
      }
      
      // Initial check
      checkHeight()
      
      // Handle toggle click
      toggle.addEventListener("click", () => {
        const isCollapsed = content.classList.contains("collapsed")
        const toggleText = toggle.querySelector("span")
        
        if (isCollapsed) {
          content.classList.remove("collapsed")
          ;(content as HTMLElement).style.maxHeight = `${threadElement.scrollHeight}px`
          applyWrapperState(false)
          toggle.setAttribute("aria-expanded", "true")
          if (toggleText) toggleText.textContent = "Show Less"
          
          // Force reflow to ensure smooth animation on first expand
          void (content as HTMLElement).offsetHeight
          window.setTimeout(() => {
            if (!content.classList.contains("collapsed")) {
              ;(content as HTMLElement).style.maxHeight = "none"
            }
          }, 400)
        } else {
          content.classList.add("collapsed")
          ;(content as HTMLElement).style.maxHeight = "420px"
          applyWrapperState(true)
          toggle.setAttribute("aria-expanded", "false")
          if (toggleText) toggleText.textContent = "Show More"
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
  
  setupDiscordToggles()
})
