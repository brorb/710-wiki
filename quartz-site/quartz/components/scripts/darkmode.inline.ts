const fixedTheme: "dark" = "dark"
document.documentElement.setAttribute("saved-theme", fixedTheme)
localStorage.setItem("theme", fixedTheme)

const emitThemeChangeEvent = (theme: "light" | "dark") => {
  const event: CustomEventMap["themechange"] = new CustomEvent("themechange", {
    detail: { theme },
  })
  document.dispatchEvent(event)
}

document.addEventListener("nav", () => {
  document.documentElement.setAttribute("saved-theme", fixedTheme)
  localStorage.setItem("theme", fixedTheme)
  emitThemeChangeEvent(fixedTheme)
})

emitThemeChangeEvent(fixedTheme)
