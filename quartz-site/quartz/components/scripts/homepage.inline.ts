import { resolveRelative } from "../../util/path"
import type { FullSlug } from "../../util/path"
import type { SerializedContentDetails } from "../../plugins/emitters/contentIndex"

type ContentIndex = Record<FullSlug, SerializedContentDetails>

type Entry = [FullSlug, SerializedContentDetails]

const HOME_SLUG = "index" as FullSlug
const RECENT_LIMIT = 6

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

const MILLISECONDS_IN_DAY = 86_400_000
const MILLISECONDS_IN_MONTH = MILLISECONDS_IN_DAY * 30
const MILLISECONDS_IN_YEAR = MILLISECONDS_IN_DAY * 365

const formatRelative = (target: Date, now: Date): string => {
  const diff = target.getTime() - now.getTime()
  const absDiff = Math.abs(diff)

  if (absDiff >= MILLISECONDS_IN_YEAR) {
    const years = Math.round(diff / MILLISECONDS_IN_YEAR)
    return relativeTimeFormat.format(years, "year")
  }

  if (absDiff >= MILLISECONDS_IN_MONTH) {
    const months = Math.round(diff / MILLISECONDS_IN_MONTH)
    return relativeTimeFormat.format(months, "month")
  }

  const days = Math.round(diff / MILLISECONDS_IN_DAY)
  return relativeTimeFormat.format(days, "day")
}

const byUpdatedDesc = (a: Entry, b: Entry) => {
  const aTime = a[1].updated ? Date.parse(a[1].updated) : 0
  const bTime = b[1].updated ? Date.parse(b[1].updated) : 0
  return bTime - aTime
}

const eligibleEntries = (data: ContentIndex, slug: FullSlug): Entry[] => {
  return Object.entries(data).filter((entry): entry is Entry => {
    const [candidate, details] = entry as Entry
    if (candidate === slug) {
      return false
    }

    if (!details.title) {
      return false
    }

    return true
  })
}

const renderRecent = (root: HTMLElement, slug: FullSlug, entries: Entry[]) => {
  const list = root.querySelector("[data-home-recent-list]") as HTMLOListElement | null
  if (!list) {
    return
  }

  list.innerHTML = ""

  const dated = entries.filter(([, details]) => Boolean(details.updated))
  const sorted = dated.sort(byUpdatedDesc).slice(0, RECENT_LIMIT)

  if (sorted.length === 0) {
    const empty = document.createElement("li")
    empty.className = "home-recent__empty"
    empty.textContent = "No recent updates yet."
    list.appendChild(empty)
    return
  }

  const now = new Date()

  sorted.forEach(([targetSlug, details]) => {
    const li = document.createElement("li")
    li.className = "home-recent__item"

    const link = document.createElement("a")
    link.className = "home-recent__link"
    link.href = resolveRelative(slug, targetSlug)
    link.textContent = details.title ?? targetSlug

    const meta = document.createElement("div")
    meta.className = "home-recent__meta"

    const updatedRaw = details.updated ?? ""
    const updatedDate = updatedRaw ? new Date(updatedRaw) : null

    if (updatedDate && !Number.isNaN(updatedDate.getTime())) {
      const time = document.createElement("time")
      time.className = "home-recent__time"
      time.dateTime = updatedDate.toISOString()
      time.textContent = updatedDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })

      const relative = document.createElement("span")
      relative.className = "home-recent__relative"
      relative.textContent = formatRelative(updatedDate, now)

      meta.append(time, document.createTextNode(" • "), relative)
    }

    li.append(link, meta)
    list.appendChild(li)
  })
}

const setupRandom = (root: HTMLElement, slug: FullSlug, entries: Entry[]) => {
  const button = root.querySelector("[data-home-random-button]") as HTMLButtonElement | null
  const result = root.querySelector("[data-home-random-result]") as HTMLElement | null
  const link = root.querySelector("[data-home-random-link]") as HTMLAnchorElement | null

  if (!button || !result || !link) {
    return
  }

  const pool = entries
  if (pool.length === 0) {
    button.disabled = true
    result.hidden = false
    link.removeAttribute("href")
    link.textContent = "No eligible pages yet"
    return
  }

  const pick = () => {
    const index = Math.floor(Math.random() * pool.length)
    const [targetSlug, details] = pool[index]
    link.href = resolveRelative(slug, targetSlug)
    link.textContent = details.title ?? targetSlug
    result.hidden = false
  }

  button.addEventListener("click", pick)
  window.addCleanup(() => button.removeEventListener("click", pick))

  pick()
}

const initHomepage = async (slug: FullSlug) => {
  if (slug !== HOME_SLUG) {
    return
  }

  const root = document.querySelector("[data-home-root]") as HTMLElement | null
  if (!root) {
    return
  }

  const data = (await fetchData) as ContentIndex
  const entries = eligibleEntries(data, slug)

  setupRandom(root, slug, entries)
  renderRecent(root, slug, entries)
}

document.addEventListener("nav", (event: CustomEventMap["nav"]) => {
  const slug = event.detail.url as FullSlug
  void initHomepage(slug)
})
