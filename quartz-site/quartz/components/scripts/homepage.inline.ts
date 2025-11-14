import { resolveRelative } from "../../util/path"
import type { FullSlug } from "../../util/path"
import type { SerializedContentDetails } from "../../plugins/emitters/contentIndex"

type ContentIndex = Record<FullSlug, SerializedContentDetails>

type Entry = [FullSlug, SerializedContentDetails]

const HOME_SLUG = "index" as FullSlug
const RECENT_LIMIT = 12
const RANDOM_TAG_LIMIT = 4
const RANDOM_SNIPPET_LIMIT = 200
const DICE_ROLL_DURATION_MS = 520
const DICE_CYCLE_INTERVAL_MS = 90
const DICE_MIN_FACE = 1
const DICE_MAX_FACE = 6

const randomDiceFace = (exclude: number | null): number => {
  let face: number
  do {
    face = Math.floor(Math.random() * (DICE_MAX_FACE - DICE_MIN_FACE + 1)) + DICE_MIN_FACE
  } while (exclude !== null && face === exclude)
  return face
}

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

const MILLISECONDS_IN_DAY = 86_400_000

const formatRelative = (target: Date, now: Date): string => {
  const targetMidnight = new Date(target)
  targetMidnight.setHours(0, 0, 0, 0)
  const nowMidnight = new Date(now)
  nowMidnight.setHours(0, 0, 0, 0)

  const diffDays = Math.round((targetMidnight.getTime() - nowMidnight.getTime()) / MILLISECONDS_IN_DAY)

  if (diffDays === 0) {
    return "today"
  }
  if (diffDays === -1) {
    return "yesterday"
  }
  if (diffDays === 1) {
    return "tomorrow"
  }

  if (Math.abs(diffDays) < 7) {
    return relativeTimeFormat.format(diffDays, "day")
  }

  if (Math.abs(diffDays) < 30) {
    return relativeTimeFormat.format(Math.round(diffDays / 7), "week")
  }

  const sameYear = target.getFullYear() === now.getFullYear()
  return target.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  })
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

const pickRandomEntry = (entries: Entry[], lastSlug: FullSlug | null): Entry => {
  if (entries.length === 0) {
    throw new Error("No entries available for random selection")
  }

  if (entries.length === 1 || lastSlug === null) {
    const index = Math.floor(Math.random() * entries.length)
    return entries[index]
  }

  let candidateIndex = Math.floor(Math.random() * entries.length)
  let candidate = entries[candidateIndex]

  if (candidate[0] !== lastSlug) {
    return candidate
  }

  do {
    candidateIndex = Math.floor(Math.random() * entries.length)
    candidate = entries[candidateIndex]
  } while (candidate[0] === lastSlug)

  return candidate
}

const toSnippet = (details: SerializedContentDetails): string | null => {
  if (!details.content) {
    return null
  }

  const strippedLinks = details.content.replace(/\[(.+?)\]\((.+?)\)/g, "$1")
  const withoutCode = strippedLinks.replace(/`{1,3}[^`]*`{1,3}/g, "")
  const normalized = withoutCode.replace(/[*_>#~]/g, " ").replace(/\s+/g, " ").trim()

  if (!normalized) {
    return null
  }

  if (normalized.length <= RANDOM_SNIPPET_LIMIT) {
    return normalized
  }

  return `${normalized.slice(0, RANDOM_SNIPPET_LIMIT - 1).trimEnd()}…`
}

const renderRandomCard = (
  container: HTMLElement,
  slug: FullSlug,
  entry: Entry,
  now: Date,
): void => {
  const [targetSlug, details] = entry
  const href = resolveRelative(slug, targetSlug)
  const displayTitle = details.title ?? targetSlug

  container.innerHTML = ""

  const link = document.createElement("a")
  link.className = "home-random-card home-random-card--enter"
  link.href = href
  link.setAttribute("aria-label", `Open ${displayTitle}`)
  link.title = `${displayTitle} — open article`

  const title = document.createElement("h3")
  title.className = "home-random-card__title"
  title.textContent = displayTitle
  link.append(title)

  const updatedRaw = details.updated ?? ""
  const updatedDate = updatedRaw ? new Date(updatedRaw) : null

  if (updatedDate && !Number.isNaN(updatedDate.getTime())) {
    const meta = document.createElement("p")
    meta.className = "home-random-card__meta"

    const label = document.createElement("span")
    label.className = "home-random-card__meta-label"
    label.textContent = "Updated"
    meta.append(label)

    const timeElement = document.createElement("time")
    timeElement.className = "home-random-card__time"
    timeElement.dateTime = updatedDate.toISOString()
    timeElement.textContent = formatRelative(updatedDate, now)
    meta.append(timeElement)

    link.append(meta)
  }

  const snippet = toSnippet(details)
  if (snippet) {
    const excerpt = document.createElement("p")
    excerpt.className = "home-random-card__snippet"
    excerpt.textContent = snippet
    link.append(excerpt)
  }

  const tags = Array.isArray(details.tags) ? details.tags.slice(0, RANDOM_TAG_LIMIT) : []
  if (tags.length > 0) {
    const list = document.createElement("ul")
    list.className = "home-random-card__tags"

    tags.forEach((tag) => {
      const item = document.createElement("li")
      item.className = "home-random-card__tag"

      const tagLink = document.createElement("a")
      tagLink.className = "home-random-card__tag-link"
      tagLink.href = resolveRelative(slug, `tags/${tag}` as FullSlug)
      tagLink.textContent = `#${tag}`
      item.append(tagLink)
      list.append(item)
    })

    link.append(list)
  }

  container.append(link)

  window.requestAnimationFrame(() => {
    link.classList.add("home-random-card--entered")
    link.classList.remove("home-random-card--enter")
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
    const item = document.createElement("li")
    item.className = "home-recent-card"

    const link = document.createElement("a")
    link.className = "home-recent-card__link"
    link.href = resolveRelative(slug, targetSlug)

    const displayTitle = details.title ?? targetSlug

    const title = document.createElement("h3")
    title.className = "home-recent-card__title"
    title.textContent = displayTitle

    const meta = document.createElement("p")
    meta.className = "home-recent-card__meta"

    const label = document.createElement("span")
    label.className = "home-recent-card__meta-label"
    label.textContent = "Updated"
    meta.append(label)

    const updatedRaw = details.updated ?? ""
    const updatedDate = updatedRaw ? new Date(updatedRaw) : null

    if (updatedDate && !Number.isNaN(updatedDate.getTime())) {
      const relativeText = formatRelative(updatedDate, now)
      const timeElement = document.createElement("time")
      timeElement.className = "home-recent-card__time"
      timeElement.dateTime = updatedDate.toISOString()
      timeElement.textContent = relativeText
      meta.append(timeElement)

      link.title = `${displayTitle} — Updated ${relativeText}`
      link.setAttribute("aria-label", link.title)
    }

    link.append(title)

    if (meta.childNodes.length > 0) {
      link.append(meta)
    }

    item.append(link)
    list.appendChild(item)
  })
}

const setupRandom = (root: HTMLElement, slug: FullSlug, entries: Entry[]) => {
  const trigger = root.querySelector("[data-home-random-trigger]") as HTMLButtonElement | null
  const dice = root.querySelector("[data-home-random-dice]") as HTMLElement | null
  const card = root.querySelector("[data-home-random-card]") as HTMLElement | null
  const placeholderTitle = root.querySelector(
    "[data-home-random-placeholder-title]",
  ) as HTMLElement | null
  const placeholderCopy = root.querySelector("[data-home-random-placeholder-copy]") as HTMLElement | null
  const emptyMessage = root.querySelector("[data-home-random-empty]") as HTMLElement | null

  if (!trigger || !card || !emptyMessage) {
    return
  }

  let currentDiceFace = dice?.dataset.face ? Number.parseInt(dice.dataset.face, 10) : DICE_MIN_FACE
  if (!Number.isFinite(currentDiceFace) || currentDiceFace < DICE_MIN_FACE || currentDiceFace > DICE_MAX_FACE) {
    currentDiceFace = DICE_MIN_FACE
  }

  let diceInterval: number | null = null

  const updateDiceFace = (face: number) => {
    if (!dice) {
      return
    }
    const clamped = Math.min(DICE_MAX_FACE, Math.max(DICE_MIN_FACE, Math.trunc(face)))
    currentDiceFace = clamped
    dice.setAttribute("data-face", clamped.toString())
  }

  const stopDiceCycle = (finalFace?: number) => {
    if (diceInterval !== null) {
      window.clearInterval(diceInterval)
      diceInterval = null
    }
    if (finalFace !== undefined) {
      updateDiceFace(finalFace)
    }
  }

  const startDiceCycle = () => {
    if (!dice) {
      return
    }
    stopDiceCycle()
    diceInterval = window.setInterval(() => {
      const nextFace = randomDiceFace(currentDiceFace)
      updateDiceFace(nextFace)
    }, DICE_CYCLE_INTERVAL_MS)
  }

  if (dice) {
    updateDiceFace(currentDiceFace)
  }

  emptyMessage.hidden = true
  trigger.disabled = false

  const pool = entries

  if (pool.length === 0) {
    trigger.disabled = true
    emptyMessage.hidden = false
    stopDiceCycle(DICE_MIN_FACE)
    if (placeholderTitle && placeholderCopy) {
      placeholderTitle.textContent = "No eligible pages yet."
      placeholderCopy.textContent = "Check back soon for more entries to explore."
    } else {
      card.innerHTML = ""

      const placeholder = document.createElement("div")
      placeholder.className = "home-random-card home-random-card--placeholder"
      placeholder.setAttribute("aria-hidden", "true")

      const title = document.createElement("h3")
      title.className = "home-random-card__title"
      title.textContent = "No eligible pages yet."
      placeholder.append(title)

      const copy = document.createElement("p")
      copy.className = "home-random-card__placeholder-copy"
      copy.textContent = "Check back soon for more entries to explore."
      placeholder.append(copy)

      card.append(placeholder)
    }
    return
  }

  let lastSlug: FullSlug | null = null
  let rollTimeout: number | null = null

  const roll = () => {
    if (trigger.disabled) {
      return
    }

    trigger.classList.add("is-rolling")
    trigger.disabled = true
    startDiceCycle()

    if (rollTimeout !== null) {
      window.clearTimeout(rollTimeout)
    }

    rollTimeout = window.setTimeout(() => {
      const finalFace = randomDiceFace(currentDiceFace)
      stopDiceCycle(finalFace)
      trigger.classList.remove("is-rolling")
      trigger.disabled = false

      const entry = pickRandomEntry(pool, lastSlug)
      lastSlug = entry[0]

      const now = new Date()
      renderRandomCard(card, slug, entry, now)
    }, DICE_ROLL_DURATION_MS)
  }

  trigger.addEventListener("click", roll)
  window.addCleanup(() => {
    trigger.removeEventListener("click", roll)
    if (rollTimeout !== null) {
      window.clearTimeout(rollTimeout)
    }
    stopDiceCycle()
  })
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

const initialSlug = (document.body?.dataset.slug ?? "") as FullSlug
void initHomepage(initialSlug)

document.addEventListener("nav", (event: CustomEventMap["nav"]) => {
  const slug = event.detail.url as FullSlug
  void initHomepage(slug)
})
