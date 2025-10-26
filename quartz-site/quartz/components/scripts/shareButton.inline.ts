const SUCCESS_STATE = "success"
const ERROR_STATE = "error"

const CLEAR_DELAY = 2800

const normalize = (value?: string | null): string | undefined => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const installShareHandler = (button: HTMLButtonElement): void => {
  if (button.dataset.shareBound === "true") {
    return
  }

  const rawUrl = normalize(button.dataset.shareUrl)
  if (!rawUrl) {
    button.disabled = true
    return
  }

  button.dataset.shareBound = "true"

  const title = normalize(button.dataset.shareTitle) ?? document.title
  const text = normalize(button.dataset.shareText)
  const copyLabel = normalize(button.dataset.shareCopied) ?? "Link copied!"
  const sharedLabel = normalize(button.dataset.shareShared) ?? "Share dialog opened."
  const errorLabel = normalize(button.dataset.shareError) ?? "Sharing not available."
  const cancelLabel = normalize(button.dataset.shareCancel)
  const feedback = button.parentElement?.querySelector(
    ".article-share__feedback",
  ) as HTMLElement | null

  let clearTimer: number | undefined

  const setFeedback = (message: string | undefined, state?: typeof SUCCESS_STATE | typeof ERROR_STATE) => {
    if (!feedback) {
      return
    }

    if (clearTimer) {
      window.clearTimeout(clearTimer)
      clearTimer = undefined
    }

    if (state) {
      feedback.dataset.state = state
    } else {
      delete feedback.dataset.state
    }

    feedback.textContent = message ?? ""

    if (message) {
      clearTimer = window.setTimeout(() => {
        if (state) {
          delete feedback.dataset.state
        }
        feedback.textContent = ""
        clearTimer = undefined
      }, CLEAR_DELAY)
    }
  }

  const resolveUrl = (): string => {
    try {
      return new URL(rawUrl, window.location.href).toString()
    } catch {
      return rawUrl
    }
  }

  const handleClick = async () => {
    const url = resolveUrl()

    try {
      if (navigator.share && typeof navigator.share === "function") {
        await navigator.share({
          title,
          text,
          url,
        })
        setFeedback(sharedLabel, SUCCESS_STATE)
        return
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url)
        setFeedback(copyLabel, SUCCESS_STATE)
        return
      }

      setFeedback(errorLabel, ERROR_STATE)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (cancelLabel) {
          setFeedback(cancelLabel)
        }
        return
      }

      setFeedback(errorLabel, ERROR_STATE)
    }
  }

  button.addEventListener("click", handleClick)
  window.addCleanup(() => button.removeEventListener("click", handleClick))
}

const setupShareButtons = () => {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".article-share__button")
  buttons.forEach((button) => installShareHandler(button))
}

setupShareButtons()
document.addEventListener("nav", setupShareButtons)
