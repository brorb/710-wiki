type Provider = "giscus" | "utterances"

type BaseCommentsElement = Omit<HTMLElement, "dataset"> & {
  dataset: DOMStringMap & {
    provider: Provider
  }
}

type GiscusElement = BaseCommentsElement & {
  dataset: DOMStringMap & {
    provider: "giscus"
    repo: `${string}/${string}`
    repoId: string
    category: string
    categoryId: string
    themeUrl: string
    lightTheme: string
    darkTheme: string
    mapping: "url" | "title" | "og:title" | "specific" | "number" | "pathname"
    strict: string
    reactionsEnabled: string
    inputPosition: "top" | "bottom"
    lang: string
  }
}

type UtterancesElement = BaseCommentsElement & {
  dataset: DOMStringMap & {
    provider: "utterances"
    repo: `${string}/${string}`
    issueTerm: string
    label: string
    theme: string
  }
}

const changeTheme = (e: CustomEventMap["themechange"]) => {
  const theme = e.detail.theme
  const iframe = document.querySelector("iframe.giscus-frame") as HTMLIFrameElement
  if (!iframe || !iframe.contentWindow) {
    return
  }

  iframe.contentWindow.postMessage(
    {
      giscus: {
        setConfig: {
          theme: getThemeUrl(getThemeName(theme)),
        },
      },
    },
    "https://giscus.app",
  )
}

const getThemeName = (theme: string) => {
  if (theme !== "dark" && theme !== "light") {
    return theme
  }
  const giscusContainer = document.querySelector(".comments.giscus") as GiscusElement
  if (!giscusContainer) {
    return theme
  }
  const darkGiscus = giscusContainer.dataset.darkTheme ?? "dark"
  const lightGiscus = giscusContainer.dataset.lightTheme ?? "light"
  return theme === "dark" ? darkGiscus : lightGiscus
}

const getThemeUrl = (theme: string) => {
  const giscusContainer = document.querySelector(".comments.giscus") as GiscusElement
  if (!giscusContainer) {
    return `https://giscus.app/themes/${theme}.css`
  }
  return `${giscusContainer.dataset.themeUrl ?? "https://giscus.app/themes"}/${theme}.css`
}

const mountGiscus = (element: GiscusElement) => {
  const giscusScript = document.createElement("script")
  giscusScript.src = "https://giscus.app/client.js"
  giscusScript.async = true
  giscusScript.crossOrigin = "anonymous"
  giscusScript.setAttribute("data-loading", "lazy")
  giscusScript.setAttribute("data-emit-metadata", "0")
  giscusScript.setAttribute("data-repo", element.dataset.repo)
  giscusScript.setAttribute("data-repo-id", element.dataset.repoId)
  giscusScript.setAttribute("data-category", element.dataset.category)
  giscusScript.setAttribute("data-category-id", element.dataset.categoryId)
  giscusScript.setAttribute("data-mapping", element.dataset.mapping)
  giscusScript.setAttribute("data-strict", element.dataset.strict)
  giscusScript.setAttribute("data-reactions-enabled", element.dataset.reactionsEnabled)
  giscusScript.setAttribute("data-input-position", element.dataset.inputPosition)
  giscusScript.setAttribute("data-lang", element.dataset.lang)
  const theme = document.documentElement.getAttribute("saved-theme")
  if (theme) {
    giscusScript.setAttribute("data-theme", getThemeUrl(getThemeName(theme)))
  }

  element.appendChild(giscusScript)

  document.addEventListener("themechange", changeTheme)
  window.addCleanup(() => document.removeEventListener("themechange", changeTheme))
}

const mountUtterances = (element: UtterancesElement) => {
  const utterancesScript = document.createElement("script")
  utterancesScript.src = "https://utteranc.es/client.js"
  utterancesScript.async = true
  utterancesScript.crossOrigin = "anonymous"
  utterancesScript.setAttribute("repo", element.dataset.repo)
  utterancesScript.setAttribute("issue-term", element.dataset.issueTerm)
  if (element.dataset.label) {
    utterancesScript.setAttribute("label", element.dataset.label)
  }
  if (element.dataset.theme) {
    utterancesScript.setAttribute("theme", element.dataset.theme)
  }

  element.appendChild(utterancesScript)
}

document.addEventListener("nav", () => {
  const container = document.querySelector(".comments") as BaseCommentsElement | null
  if (!container) {
    return
  }

  container.innerHTML = ""
  if (container.dataset.provider === "giscus") {
    mountGiscus(container as GiscusElement)
  } else if (container.dataset.provider === "utterances") {
    const utterancesEl = container as UtterancesElement
    const theme = utterancesEl.dataset.theme
    if (theme && !/^https?:\/\//i.test(theme)) {
      try {
        utterancesEl.dataset.theme = new URL(theme, window.location.origin).toString()
      } catch {
        // leave theme untouched if URL construction fails
      }
    }
    mountUtterances(utterancesEl)
  }
})
