function initializeBacklinks() {
  const containers = document.querySelectorAll(
    ".backlinks-container",
  ) as NodeListOf<HTMLElement>

  for (const container of containers) {
    const button = container.querySelector(
      ".backlinks-header",
    ) as HTMLButtonElement | null
    const content = container.querySelector(
      ".backlinks-content",
    ) as HTMLElement | null

    if (!button || !content) {
      continue
    }

    const setState = (collapsed: boolean) => {
      container.classList.toggle("collapsed", collapsed)
      button.classList.toggle("collapsed", collapsed)
      content.classList.toggle("collapsed", collapsed)
      button.setAttribute("aria-expanded", collapsed ? "false" : "true")
    }

    setState(container.classList.contains("collapsed"))

    const onToggle = () => {
      const collapsed = container.classList.contains("collapsed")
      setState(!collapsed)
    }

    button.addEventListener("click", onToggle)
    window.addCleanup(() => button.removeEventListener("click", onToggle))
  }
}

document.addEventListener("nav", () => {
  initializeBacklinks()
})
