const OBSIDIAN_LINK_PATTERN = /\[\[(?<target>[^\]|]+)(\|(?<alias>[^\]]+))?\]\]/g
const OBSIDIAN_EMBED_PATTERN = /!\[\[(?<target>[^\]]+)\]\]/g
const MARKDOWN_LINK_PATTERN = /\[(?<label>[^\]]+)\]\((?<url>[^)]+)\)/g
const MARKDOWN_IMAGE_PATTERN = /!\[(?<alt>[^\]]*)\]\((?<url>[^)]+)\)/g
const ANGLED_LINK_PATTERN = /<(?<url>https?:[^>\s]+)>/g
const INLINE_CODE_PATTERN = /`([^`]+)`/g
const STRONG_PATTERN = /\*\*([^*]+)\*\*/g
const EMPHASIS_PATTERN = /\*([^*]+)\*/g
const STRONG_UNDERSCORE_PATTERN = /__([^_]+)__/g
const EMPHASIS_UNDERSCORE_PATTERN = /_([^_]+)_/g

const normaliseLinkTarget = (target: string): string => {
  const trimmed = target.trim()
  if (!trimmed) {
    return ""
  }

  const withoutEmbedPrefix = trimmed.replace(/^!+/, "")
  const withoutAnchor = withoutEmbedPrefix.split("#").at(0) ?? withoutEmbedPrefix
  const lastSegment = withoutAnchor.split("/").filter(Boolean).pop() ?? withoutAnchor
  const normalised = lastSegment.replace(/[_-]+/g, " ").trim()
  return normalised.length > 0 ? normalised : trimmed
}

export const formatSnippetText = (value: string): string => {
  let formatted = value

  formatted = formatted.replace(OBSIDIAN_EMBED_PATTERN, "")

  formatted = formatted.replace(OBSIDIAN_LINK_PATTERN, (...args) => {
    const groups = (args[args.length - 1] ?? {}) as { target?: string; alias?: string }
    const fallbackTarget = (args[1] ?? "") as string
    const target = groups.target ?? fallbackTarget
    const aliasRaw = groups.alias ?? ""
    const aliasText = aliasRaw.trim().replace(/^\|/, "")
    if (aliasText.length > 0) {
      return aliasText
    }
    return normaliseLinkTarget(target ?? "")
  })

  formatted = formatted.replace(MARKDOWN_IMAGE_PATTERN, (...args) => {
    const alt = (args[1] ?? "") as string
    return alt.trim()
  })

  formatted = formatted.replace(MARKDOWN_LINK_PATTERN, (...args) => {
    const label = (args[1] ?? "") as string
    return label.trim()
  })

  formatted = formatted.replace(ANGLED_LINK_PATTERN, (_, url: string) => url)

  formatted = formatted.replace(INLINE_CODE_PATTERN, (_, code: string) => code)

  formatted = formatted.replace(STRONG_PATTERN, (_, text: string) => text)
  formatted = formatted.replace(EMPHASIS_PATTERN, (_, text: string) => text)
  formatted = formatted.replace(STRONG_UNDERSCORE_PATTERN, (_, text: string) => text)
  formatted = formatted.replace(EMPHASIS_UNDERSCORE_PATTERN, (_, text: string) => text)

  return formatted
}

export const normalizeSnippet = (value?: string, limit = 240): string | undefined => {
  if (!value) {
    return undefined
  }

  const formatted = formatSnippetText(value)
  const compact = formatted.replace(/\s+/g, " ").trim()
  if (!compact) {
    return undefined
  }

  if (compact.length <= limit) {
    return compact
  }

  const truncated = compact.slice(0, limit - 1).trimEnd()
  return `${truncated}…`
}
