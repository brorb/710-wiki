const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches
const userPref = prefersLight ? "light" : "dark"
const currentTheme = (localStorage.getItem("theme") as "light" | "dark" | null) ?? userPref

document.documentElement.setAttribute("saved-theme", currentTheme)

const emitThemeChangeEvent = (theme: "light" | "dark") => {
  const event: CustomEventMap["themechange"] = new CustomEvent("themechange", {
    detail: { theme },
  })
  document.dispatchEvent(event)
}

emitThemeChangeEvent(currentTheme)

document.addEventListener("nav", () => {
  const switchTheme = () => {
    const savedTheme = document.documentElement.getAttribute("saved-theme") === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("saved-theme", savedTheme)
    localStorage.setItem("theme", savedTheme)
    emitThemeChangeEvent(savedTheme)
  }

  const themeChange = (event: MediaQueryListEvent) => {
    const newTheme = event.matches ? "dark" : "light"
    document.documentElement.setAttribute("saved-theme", newTheme)
    localStorage.setItem("theme", newTheme)
    emitThemeChangeEvent(newTheme)
  }

  for (const darkmodeButton of document.getElementsByClassName("darkmode")) {
    darkmodeButton.addEventListener("click", switchTheme)
    window.addCleanup(() => darkmodeButton.removeEventListener("click", switchTheme))
  }

  const colorSchemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
  colorSchemeMediaQuery.addEventListener("change", themeChange)
  window.addCleanup(() => colorSchemeMediaQuery.removeEventListener("change", themeChange))
})
