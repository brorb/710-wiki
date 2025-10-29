const INTERACTIVE_SKIP_SELECTOR = "a[href], button, input, textarea, select, label, audio, video, svg[focusable='true'], [contenteditable='true']"

const hasActiveSelection = (): boolean => {
  const selection = window.getSelection()
  return !!selection && selection.toString().trim().length > 0
}

const shouldSkipTarget = (target: EventTarget | null, container: HTMLElement): boolean => {
  if (!(target instanceof Element)) {
    return false
  }

  if (!container.contains(target)) {
    return false
  }

  if (target.closest("[data-discord-jump-skip]")) {
    return true
  }

  if (target.closest(INTERACTIVE_SKIP_SELECTOR)) {
    return true
  }

  return false
}

const openJumpLink = (url: string): void => {
  window.open(url, "_blank", "noopener,noreferrer")
}

const installDiscordJump = (message: HTMLElement): void => {
  if (message.dataset.discordJumpBound === "true") {
    return
  }

  const url = message.dataset.discordJump?.trim()
  if (!url) {
    return
  }

  message.dataset.discordJumpBound = "true"

  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented) {
      return
    }

    if (event.button !== 0) {
      return
    }

    if (shouldSkipTarget(event.target, message)) {
      return
    }

    if (hasActiveSelection()) {
      return
    }

    event.preventDefault()
    openJumpLink(url)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return
    }

    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar" && event.key !== "Space") {
      return
    }

    if (event.target instanceof Element && event.target !== message) {
      return
    }

    if (event.repeat) {
      return
    }

    event.preventDefault()
    openJumpLink(url)
  }

  message.addEventListener("click", handleClick)
  message.addEventListener("keydown", handleKeyDown)

  window.addCleanup(() => {
    message.removeEventListener("click", handleClick)
    message.removeEventListener("keydown", handleKeyDown)
  })
}

const setupDiscordJumps = (): void => {
  const messages = document.querySelectorAll<HTMLElement>("[data-discord-jump]")
  messages.forEach((message) => installDiscordJump(message))
}

setupDiscordJumps()
document.addEventListener("nav", setupDiscordJumps)
