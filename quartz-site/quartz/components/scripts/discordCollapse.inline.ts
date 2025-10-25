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
      
      // Check if content is taller than collapsed height
      const checkHeight = () => {
        const fullHeight = threadElement.scrollHeight
        const collapsedHeight = 600
        
        if (fullHeight <= collapsedHeight) {
          (toggle as HTMLElement).style.display = "none"
          content.classList.remove("collapsed")
          ;(content as HTMLElement).style.maxHeight = "none"
        } else {
          (toggle as HTMLElement).style.display = "flex"
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
          toggle.setAttribute("aria-expanded", "true")
          if (toggleText) toggleText.textContent = "Show Less"
          
          // Force reflow to ensure smooth animation on first expand
          void (content as HTMLElement).offsetHeight
        } else {
          content.classList.add("collapsed")
          ;(content as HTMLElement).style.maxHeight = "600px"
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
