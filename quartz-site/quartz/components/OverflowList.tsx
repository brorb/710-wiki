import { JSX } from "preact"

const OverflowList = ({
  children,
  ...props
}: JSX.HTMLAttributes<HTMLUListElement> & { id: string }) => {
  return (
    <ul {...props} class={[props.class, "overflow"].filter(Boolean).join(" ")} id={props.id}>
      {children}
      <li class="overflow-end" />
    </ul>
  )
}

let numLists = 0
export default () => {
  const id = `list-${numLists++}`

  return {
    OverflowList: (props: JSX.HTMLAttributes<HTMLUListElement>) => (
      <OverflowList {...props} id={id} />
    ),
    overflowListAfterDOMLoaded: `
document.addEventListener("nav", () => {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const parentUl = entry.target.parentElement
      if (!parentUl) return
      if (entry.isIntersecting) {
        parentUl.classList.remove("gradient-active")
      } else {
        parentUl.classList.add("gradient-active")
      }
    }
  })

  const ul = document.getElementById("${id}")
  if (!ul) return

  const end = ul.querySelector(".overflow-end")
  if (!end) return

  observer.observe(end)
  window.addCleanup(() => observer.disconnect())

  const scrollHostCandidate = ul.closest(".explorer-content, .toc-content, .backlinks-content")
  const scrollContainer = scrollHostCandidate instanceof HTMLElement ? scrollHostCandidate : ul
  const hostCandidate =
    scrollContainer.closest(".explorer") ||
    scrollContainer.closest(".toc-container") ||
    scrollContainer.closest(".backlinks-container")
  const proxyHost = hostCandidate instanceof HTMLElement ? hostCandidate : scrollContainer

  if (!(proxyHost instanceof HTMLElement) || proxyHost.hasAttribute("data-scroll-proxy")) {
    return
  }

  const wheelHandler = (event) => {
    if (proxyHost.classList.contains("collapsed") || scrollContainer.classList.contains("collapsed")) {
      return
    }

    if (scrollContainer.scrollHeight <= scrollContainer.clientHeight + 1) {
      return
    }

    const multiplier =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? scrollContainer.clientHeight
          : 1
    const delta = event.deltaY * multiplier
    if (delta === 0) {
      return
    }

    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight
    const nextScroll = Math.min(maxScroll, Math.max(0, scrollContainer.scrollTop + delta))

    if (nextScroll === scrollContainer.scrollTop) {
      return
    }

    scrollContainer.scrollTop = nextScroll
    event.preventDefault()
    event.stopPropagation()
  }

  proxyHost.addEventListener("wheel", wheelHandler, { passive: false })
  proxyHost.setAttribute("data-scroll-proxy", "true")

  window.addCleanup(() => {
    proxyHost.removeEventListener("wheel", wheelHandler)
    proxyHost.removeAttribute("data-scroll-proxy")
  })
})
`,
  }
}
