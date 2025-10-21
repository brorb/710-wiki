import { Code } from "mdast"
import { QuartzTransformerPlugin } from "../types"
import { SKIP, visit } from "unist-util-visit"

type RawInfoboxItem = {
  label?: string
  value?: string | string[]
}

type MutableInfoboxItem = {
  label: string
  values: string[]
}

type RawInfoboxImage = {
  src?: string
  alt?: string
  caption?: string
}

type RawInfobox = {
  title?: string
  image?: RawInfoboxImage
  items?: RawInfoboxItem[]
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim()

const splitListValues = (raw: string): string[] => {
  if (!raw) {
    return []
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return []
  }

  const parts = trimmed
    .split(/(?<!\\);/)
    .map((part) => part.replace(/\\;/g, ";").trim())
    .filter((part) => part.length > 0)

  if (parts.length > 0) {
    return parts
  }

  return [trimmed]
}

const parseInfoboxBlock = (raw: string): RawInfobox | null => {
  const lines = raw.split(/\r?\n/)
  let title: string | undefined
  const image: RawInfoboxImage = {}
  const items: MutableInfoboxItem[] = []
  let currentItem: MutableInfoboxItem | null = null

  for (const originalLine of lines) {
    const trimmed = originalLine.trim()
    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith("#")) {
      continue
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(1).trim()
      if (!content || !currentItem) {
        continue
      }

      currentItem.values.push(content)
      continue
    }

    const colonIndex = trimmed.indexOf(":")
    if (colonIndex === -1) {
      continue
    }

    const keyRaw = trimmed.slice(0, colonIndex).trim()
    const valueRaw = trimmed.slice(colonIndex + 1).trim()
    const key = keyRaw.toLowerCase()

    switch (key) {
      case "title": {
        title = valueRaw ? normalizeWhitespace(valueRaw) : undefined
        currentItem = null
        break
      }
      case "image":
      case "image src":
      case "media": {
        image.src = valueRaw
        currentItem = null
        break
      }
      case "image alt":
      case "alt": {
        image.alt = valueRaw ? normalizeWhitespace(valueRaw) : undefined
        currentItem = null
        break
      }
      case "image caption":
      case "caption": {
        image.caption = valueRaw
        currentItem = null
        break
      }
      default: {
        const values = splitListValues(valueRaw)
        const item: MutableInfoboxItem = {
          label: keyRaw,
          values,
        }

        items.push(item)
        currentItem = item
        break
      }
    }
  }

  const normalizedItems = items
    .map(({ label, values }) => {
      const distinct = values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
      if (distinct.length === 0) {
        return null
      }

      return {
        label,
        value: distinct.length === 1 ? distinct[0] : distinct,
      }
    })
    .filter((entry): entry is { label: string; value: string | string[] } => entry !== null)

  const hasImage = Boolean(image.src || image.alt || image.caption)
  const hasContent = Boolean(title || hasImage || normalizedItems.length > 0)

  if (!hasContent) {
    return null
  }

  return {
    title,
    image: hasImage ? image : undefined,
    items: normalizedItems.map(({ label, value }) => ({
      label,
      value,
    })),
  }
}

export const InfoboxBlock: QuartzTransformerPlugin = () => {
  return {
    name: "InfoboxBlock",
    markdownPlugins() {
      return [
        () => (tree, file) => {
          visit(tree, "code", (node: Code, index, parent) => {
            const language = typeof node.lang === "string" ? node.lang.toLowerCase() : ""
            if (language !== "infobox") {
              return
            }

            const raw = typeof node.value === "string" ? node.value : ""
            const parsed = parseInfoboxBlock(raw)
            if (!parsed) {
              if (parent && typeof index === "number") {
                parent.children.splice(index, 1)
                return [SKIP, index]
              }
              return
            }

            file.data.infobox = parsed
            file.data.infoboxSource = "code-block"

            if (parent && typeof index === "number") {
              parent.children.splice(index, 1)
              return [SKIP, index]
            }
          })
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    infobox?: {
      title?: string
      image?: {
        src?: string
        alt?: string
        caption?: string
      }
      items?: {
        label?: string
        value?: string | string[]
      }[]
    }
    infoboxSource?: "code-block"
  }
}
