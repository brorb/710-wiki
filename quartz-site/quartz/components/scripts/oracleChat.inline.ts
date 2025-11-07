type OracleRole = "user" | "assistant" | "system" | "error"

type OracleWebSnippet = {
  title?: string
  summary?: string
  url?: string
  section?: string
  strength?: string
  alias?: string
}

type OracleWebSource = {
  title?: string
  description?: string
  url?: string
  section?: string
  strength?: string
}

type OracleWebPayload = {
  lead?: string
  answer?: string
  contextSnippets?: OracleWebSnippet[]
  sources?: OracleWebSource[]
  followUpQuestions?: string[]
  callToAction?: string
  disclaimers?: string[]
}

type FollowUpContext = {
  source: "suggestion"
  index: number
}

type MessageRenderOptions = {
  onFollowUpSelect?: (question: string, context: FollowUpContext) => void
  getConversationId?: () => string | null
}

type OracleMessage = {
  id: string
  role: OracleRole
  content: string
  createdAt: number
  pending?: boolean
  webPayload?: OracleWebPayload
  disclaimers?: string[]
  rawReply?: string
  promptContext?: string
}

type LinkEntry = {
  label: string
  url?: string
  meta?: string
}

type PendingContextState = {
  titles: string[]
  empty: boolean
  lastUpdated: number
}

type OracleState = {
  conversationId?: string
  messages: OracleMessage[]
  lastOpenedAt?: number
}

type OracleConfig = {
  apiBaseUrl: string
  endpointPath: string
  contextStreamPath: string
  storageKey: string
  maxHistory: number
  recaptchaSiteKey?: string
  article?: {
    title?: string
    slug?: string
  }
}

type OracleRequestPayload = {
  conversationId: string | null
  clientMessageId?: string
  question: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  metadata: Record<string, unknown>
  priority?: "low" | "medium" | "high"
  sections?: number
  creativeMode?: boolean
  captchaToken?: string
  channel?: string
}

type RecaptchaClient = {
  execute: (siteKey: string, options: { action: string }) => Promise<string>
  ready: (cb: () => void) => void
}

type FetchResult = {
  conversationId?: string | null
  reply?: string | null
  messages?: Array<{ role: "assistant" | "system"; content: string }>
  success?: boolean
  reason?: string
  metadata?: Record<string, unknown>
  webPayload?: unknown
  disclaimers?: unknown
}

const isDialogueRole = (role: OracleRole): role is "user" | "assistant" => role === "user" || role === "assistant"

const chatTeleportState = new WeakMap<
  HTMLElement,
  {
    parent: Node
    placeholder: Comment
  }
>()

const moveChatToBody = (dialog: HTMLElement) => {
  if (dialog.parentElement === document.body) {
    return
  }

  const parent = dialog.parentNode
  if (!parent) {
    return
  }

  const placeholder = document.createComment("oracle-chat-home")
  parent.insertBefore(placeholder, dialog)
  chatTeleportState.set(dialog, { parent, placeholder })
  document.body.appendChild(dialog)
}

const restoreChat = (dialog: HTMLElement) => {
  const state = chatTeleportState.get(dialog)
  if (!state) {
    return
  }

  const { parent, placeholder } = state
  if (parent.isConnected) {
    parent.insertBefore(dialog, placeholder)
  }

  placeholder.remove()
  chatTeleportState.delete(dialog)
}

const DEFAULT_STORAGE_KEY = "oracle-chat-history"
const DEFAULT_ENDPOINT = "/api/oracle/query"
const DEFAULT_STREAM_ENDPOINT = "/api/oracle/context-stream"
const DEFAULT_MAX_HISTORY = 24
const SEND_COOLDOWN_MS = 1200
const RECAPTCHA_ACTION = "oracle_chat"
const DEBUG_ENABLED = true

const debugLog = (...args: Array<unknown>) => {
  if (!DEBUG_ENABLED) {
    return
  }

  console.info("ORA_CLE chat debug:", ...args)
}

const emitAnalytics = (eventName: string, detail: Record<string, unknown> = {}) => {
  const payload = {
    event: eventName,
    detail,
    timestamp: Date.now(),
  }

  try {
    window.dispatchEvent(new CustomEvent("oracle-analytics", { detail: payload }))
  } catch (error) {
    debugLog("Analytics dispatch (window) failed", error)
  }

  try {
    document.dispatchEvent(new CustomEvent("oracle-analytics", { detail: payload }))
  } catch (error) {
    debugLog("Analytics dispatch (document) failed", error)
  }

  debugLog("Analytics event", payload)
}

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const candidate = toTrimmedString(value)
    if (candidate) {
      return candidate
    }
  }
  return undefined
}

const toTrimmedStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const normalised = value
    .map((entry) => toTrimmedString(entry))
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)

  return normalised.length > 0 ? Array.from(new Set(normalised)) : undefined
}

const isOracleRole = (value: unknown): value is OracleRole =>
  value === "user" || value === "assistant" || value === "system" || value === "error"

const parseWebSnippet = (value: unknown): OracleWebSnippet | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const raw = value as Record<string, unknown>
  const snippet: OracleWebSnippet = {}

  snippet.title = pickString(raw.title, raw.heading, raw.label)
  snippet.summary = pickString(raw.summary, raw.excerpt, raw.note, raw.body)
  snippet.url = pickString(raw.url, raw.href, raw.link)
  snippet.section = pickString(raw.section, raw.sectionLabel, raw.category)
  snippet.strength = pickString(raw.strength, raw.confidence, raw.score)
  snippet.alias = pickString(raw.alias, raw.sourceTitle, raw.display, raw.origin)

  return Object.values(snippet).some((entry) => typeof entry === "string" && entry.length > 0)
    ? snippet
    : undefined
}

const parseWebSource = (value: unknown): OracleWebSource | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const raw = value as Record<string, unknown>
  const source: OracleWebSource = {}

  source.title = pickString(raw.title, raw.label, raw.name)
  source.description = pickString(raw.description, raw.summary, raw.note)
  source.url = pickString(raw.url, raw.href, raw.link)
  source.section = pickString(raw.section, raw.sectionLabel)
  source.strength = pickString(raw.strength, raw.confidence)

  return Object.values(source).some((entry) => typeof entry === "string" && entry.length > 0)
    ? source
    : undefined
}

const parseWebPayload = (value: unknown): OracleWebPayload | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const raw = value as Record<string, unknown>
  const payload: OracleWebPayload = {}

  payload.lead = pickString(raw.lead, raw.preview, raw.heading)
  payload.answer = pickString(raw.answer, raw.body, raw.summary)
  payload.callToAction = pickString(raw.callToAction, raw.cta)

  const followUps = toTrimmedStringArray(raw.followUpQuestions ?? raw.followUps)
  if (followUps) {
    payload.followUpQuestions = followUps
  }

  const snippetSource = Array.isArray(raw.contextSnippets) ? raw.contextSnippets : raw.snippets
  if (Array.isArray(snippetSource)) {
    const snippets = snippetSource
      .map((entry) => parseWebSnippet(entry))
      .filter((entry): entry is OracleWebSnippet => Boolean(entry))
    if (snippets.length > 0) {
      payload.contextSnippets = snippets
    }
  }

  if (Array.isArray(raw.sources)) {
    const sources = raw.sources
      .map((entry) => parseWebSource(entry))
      .filter((entry): entry is OracleWebSource => Boolean(entry))
    if (sources.length > 0) {
      payload.sources = sources
    }
  }

  const disclaimers = toTrimmedStringArray(raw.disclaimers)
  if (disclaimers) {
    payload.disclaimers = disclaimers
  }

  return Object.values(payload).some((entry) => {
    if (Array.isArray(entry)) {
      return entry.length > 0
    }
    return typeof entry === "string" && entry.length > 0
  })
    ? payload
    : undefined
}

const serialiseWebSnippet = (snippet: OracleWebSnippet | undefined): OracleWebSnippet | undefined => {
  if (!snippet) {
    return undefined
  }

  const copy: OracleWebSnippet = {}
  if (snippet.title) {
    copy.title = snippet.title
  }
  if (snippet.summary) {
    copy.summary = snippet.summary
  }
  if (snippet.url) {
    copy.url = snippet.url
  }
  if (snippet.section) {
    copy.section = snippet.section
  }
  if (snippet.strength) {
    copy.strength = snippet.strength
  }
  if (snippet.alias) {
    copy.alias = snippet.alias
  }

  return Object.values(copy).some((entry) => typeof entry === "string" && entry.length > 0) ? copy : undefined
}

const serialiseWebSource = (source: OracleWebSource | undefined): OracleWebSource | undefined => {
  if (!source) {
    return undefined
  }

  const copy: OracleWebSource = {}
  if (source.title) {
    copy.title = source.title
  }
  if (source.description) {
    copy.description = source.description
  }
  if (source.url) {
    copy.url = source.url
  }
  if (source.section) {
    copy.section = source.section
  }
  if (source.strength) {
    copy.strength = source.strength
  }

  return Object.values(copy).some((entry) => typeof entry === "string" && entry.length > 0) ? copy : undefined
}

const serialiseWebPayload = (payload: OracleWebPayload | undefined): OracleWebPayload | undefined => {
  if (!payload) {
    return undefined
  }

  const copy: OracleWebPayload = {}

  if (payload.lead) {
    copy.lead = payload.lead
  }
  if (payload.answer) {
    copy.answer = payload.answer
  }
  if (payload.callToAction) {
    copy.callToAction = payload.callToAction
  }
  if (payload.followUpQuestions?.length) {
    copy.followUpQuestions = [...payload.followUpQuestions]
  }
  if (payload.disclaimers?.length) {
    copy.disclaimers = [...payload.disclaimers]
  }
  if (payload.contextSnippets?.length) {
    const snippets = payload.contextSnippets
      .map((snippet) => serialiseWebSnippet(snippet))
      .filter((entry): entry is OracleWebSnippet => Boolean(entry))
    if (snippets.length > 0) {
      copy.contextSnippets = snippets
    }
  }
  if (payload.sources?.length) {
    const sources = payload.sources
      .map((source) => serialiseWebSource(source))
      .filter((entry): entry is OracleWebSource => Boolean(entry))
    if (sources.length > 0) {
      copy.sources = sources
    }
  }

  return Object.values(copy).some((entry) => {
    if (Array.isArray(entry)) {
      return entry.length > 0
    }
    return typeof entry === "string" && entry.length > 0
  })
    ? copy
    : undefined
}

const snapshotConfig = (config: OracleConfig) => ({
  apiBaseUrl: config.apiBaseUrl || null,
  endpointPath: config.endpointPath,
  contextStreamPath: config.contextStreamPath,
  storageKey: config.storageKey,
  maxHistory: config.maxHistory,
  hasRecaptcha: Boolean(config.recaptchaSiteKey),
})

const summariseRequest = (payload: OracleRequestPayload) => ({
  conversationId: payload.conversationId,
  clientMessageId: payload.clientMessageId ?? null,
  questionPreview: payload.question.slice(0, 80),
  messageRoles: payload.messages.map((message) => message.role),
  metadataKeys: Object.keys(payload.metadata || {}),
  hasCaptcha: Boolean(payload.captchaToken),
})

const getDatasetConfig = (root: HTMLElement): OracleConfig => {
  const {
    oracleApiBase = "",
    oracleEndpoint = DEFAULT_ENDPOINT,
    oracleContextStream,
    oracleStorageKey,
    oracleMaxHistory,
    oracleRecaptchaKey,
    oracleArticleTitle,
    oracleArticleSlug,
  } = root.dataset

  const storageKey = oracleStorageKey?.trim() || DEFAULT_STORAGE_KEY
  const maxHistory = Number.parseInt(oracleMaxHistory ?? "", 10)
  const safeMaxHistory = Number.isFinite(maxHistory) && maxHistory > 0 ? maxHistory : DEFAULT_MAX_HISTORY

  return {
    apiBaseUrl: oracleApiBase?.trim() || "",
    endpointPath: oracleEndpoint?.trim() || DEFAULT_ENDPOINT,
  contextStreamPath: oracleContextStream?.trim() || DEFAULT_STREAM_ENDPOINT,
    storageKey,
    maxHistory: safeMaxHistory,
    recaptchaSiteKey: oracleRecaptchaKey?.trim() || undefined,
    article: {
      title: oracleArticleTitle?.trim() || undefined,
      slug: oracleArticleSlug?.trim() || undefined,
    },
  }
}

const resolveEndpointUrl = (baseUrl: string, endpoint: string): string => {
  const trimmedEndpoint = endpoint.startsWith("/") || endpoint.startsWith("http") ? endpoint : `/${endpoint}`

  if (!baseUrl) {
    if (trimmedEndpoint.startsWith("http")) {
      return trimmedEndpoint
    }
    return `${window.location.origin}${trimmedEndpoint}`
  }

  if (baseUrl.startsWith("http")) {
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
    return trimmedEndpoint.startsWith("/") ? `${base}${trimmedEndpoint}` : `${base}/${trimmedEndpoint}`
  }

  const normalisedBase = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`
  const normalised = normalisedBase.endsWith("/") ? normalisedBase.slice(0, -1) : normalisedBase
  const suffix = trimmedEndpoint.startsWith("/") ? trimmedEndpoint : `/${trimmedEndpoint}`
  return `${window.location.origin}${normalised}${suffix}`
}

const buildRequestUrl = (config: OracleConfig): string => resolveEndpointUrl(config.apiBaseUrl, config.endpointPath)

const buildStreamUrl = (config: OracleConfig, conversationId: string | undefined, messageId: string): string => {
  const base = resolveEndpointUrl(config.apiBaseUrl, config.contextStreamPath)
  const streamUrl = new URL(base, window.location.origin)
  streamUrl.searchParams.set("messageId", messageId)
  if (conversationId) {
    streamUrl.searchParams.set("conversationId", conversationId)
  }
  return streamUrl.toString()
}

const loadState = (storageKey: string): OracleState => {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return { messages: [] }
    }

    const parsed = JSON.parse(raw) as Partial<OracleState>
    const restoredMessages: OracleMessage[] = Array.isArray(parsed.messages)
      ? parsed.messages
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null
            }

            const candidate = entry as Partial<OracleMessage> & Record<string, unknown>
            if (!isOracleRole(candidate.role)) {
              return null
            }

            const content = toTrimmedString(candidate.content)
            if (!content) {
              return null
            }

            const restored: OracleMessage = {
              id: toTrimmedString(candidate.id) ?? generateId(),
              role: candidate.role,
              content,
              createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
            }

            if (candidate.pending) {
              restored.pending = Boolean(candidate.pending)
            }

            const payload = parseWebPayload((candidate as { webPayload?: unknown }).webPayload)
            if (payload) {
              restored.webPayload = payload
            }

            const disclaimers = toTrimmedStringArray((candidate as { disclaimers?: unknown }).disclaimers)
            if (disclaimers) {
              restored.disclaimers = disclaimers
            }

            const rawReply = toTrimmedString((candidate as { rawReply?: unknown }).rawReply)
            if (rawReply) {
              restored.rawReply = rawReply
            }

            const promptContext = toTrimmedString((candidate as { promptContext?: unknown }).promptContext)
            if (promptContext) {
              restored.promptContext = promptContext
            }

            return restored
          })
          .filter((entry): entry is OracleMessage => Boolean(entry))
      : []

    return {
      conversationId: toTrimmedString(parsed.conversationId) ?? undefined,
      lastOpenedAt: typeof parsed.lastOpenedAt === "number" ? parsed.lastOpenedAt : undefined,
      messages: restoredMessages,
    }
  } catch (error) {
    console.warn("ORA_CLE chat: unable to read stored state", error)
    return { messages: [] }
  }
}

const persistState = (storageKey: string, state: OracleState, maxHistory: number) => {
  try {
    const trimmedMessages = state.messages.slice(-maxHistory)
    const payload: OracleState = {
      conversationId: state.conversationId,
      lastOpenedAt: state.lastOpenedAt ?? Date.now(),
      messages: trimmedMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        pending: message.pending,
        webPayload: serialiseWebPayload(message.webPayload),
        disclaimers: message.disclaimers ? [...message.disclaimers] : undefined,
        rawReply: message.rawReply,
        promptContext: message.promptContext,
      })),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (error) {
    console.warn("ORA_CLE chat: unable to persist chat state", error)
  }
}

const createHelperElement = (tag: string, className: string, text?: string): HTMLElement => {
  const element = document.createElement(tag)
  element.className = className
  if (typeof text === "string") {
    element.textContent = text
  }
  return element
}

const isSafeUrl = (value: string): boolean => /^(https?:\/\/|mailto:|#|\/)/i.test(value)

const normaliseLinkTarget = (value: string): string | undefined => {
  let trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed || undefined
}

const appendMarkdownWithLinks = (
  target: HTMLElement,
  text: string,
  onLinkClick?: (url: string) => void,
) => {
  const renderLine = (line: string) => {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(line)) !== null) {
      const preceding = line.slice(lastIndex, match.index)
      if (preceding) {
        target.appendChild(document.createTextNode(preceding))
      }

      const label = match[1]
      const rawUrl = normaliseLinkTarget(match[2])

      if (rawUrl && isSafeUrl(rawUrl)) {
        const anchor = document.createElement("a")
  anchor.href = rawUrl
        anchor.textContent = label
        if (onLinkClick) {
          anchor.addEventListener("click", () => onLinkClick(rawUrl))
        }
        target.appendChild(anchor)
      } else {
        target.appendChild(document.createTextNode(match[0]))
      }

      lastIndex = pattern.lastIndex
    }

    const remainder = line.slice(lastIndex)
    if (remainder) {
      target.appendChild(document.createTextNode(remainder))
    }
  }

  const lines = text.split(/\n/)
  lines.forEach((line, index) => {
    if (index > 0) {
      target.appendChild(document.createElement("br"))
    }
    renderLine(line)
  })
}

const appendMarkdownParagraphs = (
  container: HTMLElement,
  className: string,
  text: string,
  onLinkClick?: (url: string) => void,
) => {
  text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .forEach((block) => {
      const paragraph = document.createElement("p")
      paragraph.className = className
      appendMarkdownWithLinks(paragraph, block, onLinkClick)
      container.appendChild(paragraph)
    })
}

const dedupeBy = <T>(items: T[], selector: (item: T) => string | undefined): T[] => {
  const seen = new Set<string>()
  const result: T[] = []
  items.forEach((item) => {
    const key = selector(item)
    if (!key || !seen.has(key)) {
      if (key) {
        seen.add(key)
      }
      result.push(item)
    }
  })
  return result
}

const createLinkRail = (
  label: string,
  entries: LinkEntry[],
  onLinkClick?: (url: string, index: number) => void,
): HTMLElement | undefined => {
  if (!entries.length) {
    return undefined
  }

  const rail = document.createElement("div")
  rail.className = "oracle-chat__link-rail"
  rail.appendChild(createHelperElement("span", "oracle-chat__link-rail-label", label))

  const scroller = document.createElement("div")
  scroller.className = "oracle-chat__link-rail-items"

  entries.forEach((entry, index) => {
    const displayMeta = entry.meta ? ` • ${entry.meta}` : ""
    const displayText = `${entry.label}${displayMeta}`

    if (entry.url && isSafeUrl(entry.url)) {
      const anchor = document.createElement("a")
      anchor.className = "oracle-chat__pill-link"
  anchor.href = entry.url
      anchor.textContent = displayText
      anchor.title = displayText
      if (onLinkClick) {
        const url = entry.url
        anchor.addEventListener("click", () => onLinkClick(url, index))
      }
      scroller.appendChild(anchor)
    } else {
      const span = document.createElement("span")
      span.className = "oracle-chat__pill-link oracle-chat__pill-link--static"
      span.textContent = displayText
      scroller.appendChild(span)
    }
  })

  rail.appendChild(scroller)
  return rail
}

const renderAssistantMessage = (
  bubble: HTMLElement,
  message: OracleMessage,
  options?: MessageRenderOptions,
) => {
  const payload = message.webPayload
  const leadText = payload?.lead ?? payload?.answer ?? message.content
  const secondaryText = payload?.answer && payload.answer !== leadText ? payload.answer : undefined
  const fallbackText = !payload ? message.content : undefined
  const allDisclaimers = new Set<string>()

  if (Array.isArray(payload?.disclaimers)) {
    payload?.disclaimers?.forEach((entry) => {
      const normalised = toTrimmedString(entry)
      if (normalised) {
        allDisclaimers.add(normalised)
      }
    })
  }

  if (Array.isArray(message.disclaimers)) {
    message.disclaimers.forEach((entry) => {
      const normalised = toTrimmedString(entry)
      if (normalised) {
        allDisclaimers.add(normalised)
      }
    })
  }

  bubble.innerHTML = ""

  if (message.pending) {
    bubble.classList.add("oracle-chat__bubble--pending")
    const pendingText = toTrimmedString(message.content) ?? "The ORA_CLE is thinking..."
    bubble.appendChild(createHelperElement("p", "oracle-chat__pending-text", pendingText))
    const contextLine = createHelperElement("p", "oracle-chat__pending-context")
    contextLine.setAttribute("data-oracle-pending-context", message.id)
    contextLine.hidden = true
    bubble.appendChild(contextLine)
    return
  }

  const addLinkAnalytics = (kind: "source" | "answer", url?: string, index?: number) => {
    if (!url) {
      return
    }
    emitAnalytics("oracle:link-clicked", {
      kind,
      url,
      index: typeof index === "number" ? index : null,
      conversationId: options?.getConversationId?.() ?? null,
      messageId: message.id,
    })
  }

  if (leadText) {
    appendMarkdownParagraphs(
      bubble,
      "oracle-chat__answer-lead oracle-chat__rich-text",
      leadText,
      (url) => addLinkAnalytics("answer", url),
    )
  }

  if (secondaryText) {
    appendMarkdownParagraphs(
      bubble,
      "oracle-chat__answer-body oracle-chat__rich-text",
      secondaryText,
      (url) => addLinkAnalytics("answer", url),
    )
  } else if (!payload && fallbackText) {
    appendMarkdownParagraphs(
      bubble,
      "oracle-chat__answer-body oracle-chat__rich-text",
      fallbackText,
      (url) => addLinkAnalytics("answer", url),
    )
  }

  const buildSourceEntries = (): LinkEntry[] => {
    if (!payload?.sources?.length) {
      return []
    }
    const items = payload.sources
      .map<LinkEntry | undefined>((source) => {
        const label = toTrimmedString(source.title ?? source.url)
        if (!label) {
          return undefined
        }

        const metaParts: string[] = []
        if (source.description) {
          metaParts.push(source.description)
        }
        if (source.section) {
          metaParts.push(source.section)
        }
        if (source.strength) {
          metaParts.push(source.strength)
        }

        return {
          label,
          url: source.url ? normaliseLinkTarget(source.url) : undefined,
          meta: metaParts.length > 0 ? metaParts.join(" • ") : undefined,
        }
      })
      .filter((entry): entry is LinkEntry => Boolean(entry))

    return dedupeBy(items, (entry) => `${entry.label}|${entry.url ?? ""}`)
  }

  const sourceEntries = buildSourceEntries()

  const sourceRail = createLinkRail("Sources", sourceEntries, (url, index) =>
    addLinkAnalytics("source", url, index),
  )
  if (sourceRail) {
    bubble.appendChild(sourceRail)
  }

  if (payload?.callToAction) {
    bubble.appendChild(createHelperElement("p", "oracle-chat__cta", payload.callToAction))
  }

  if (payload?.followUpQuestions?.length) {
    const followUpsWrapper = document.createElement("div")
    followUpsWrapper.className = "oracle-chat__followups"
    followUpsWrapper.appendChild(createHelperElement("p", "oracle-chat__followups-label", "Suggested follow-ups"))

    const buttons = document.createElement("div")
    buttons.className = "oracle-chat__followup-buttons"

    payload.followUpQuestions.forEach((question, index) => {
      const trimmed = toTrimmedString(question)
      if (!trimmed) {
        return
      }
      const button = document.createElement("button")
      button.type = "button"
      button.className = "oracle-chat__followup-button"
      button.textContent = trimmed
      button.addEventListener("click", () => {
        options?.onFollowUpSelect?.(trimmed, { source: "suggestion", index })
      })
      buttons.appendChild(button)
    })

    if (buttons.children.length > 0) {
      followUpsWrapper.appendChild(buttons)
      bubble.appendChild(followUpsWrapper)
    }
  }


  const disclaimersList = Array.from(allDisclaimers)
  if (disclaimersList.length > 0) {
    const list = document.createElement("ul")
    list.className = "oracle-chat__disclaimers"
    disclaimersList.forEach((entry) => {
      const item = document.createElement("li")
      item.className = "oracle-chat__disclaimer-item"
      item.textContent = entry
      list.appendChild(item)
    })
    bubble.appendChild(list)
  }
}

const createMessageElement = (message: OracleMessage, options?: MessageRenderOptions): HTMLElement => {
  const wrapper = document.createElement("div")
  wrapper.className = "oracle-chat__message"
  wrapper.dataset.role = message.role
  wrapper.dataset.messageId = message.id

  if (message.role === "user") {
    wrapper.classList.add("oracle-chat__message--user")
  } else if (message.role === "assistant" || message.role === "system") {
    wrapper.classList.add("oracle-chat__message--assistant")
  } else if (message.role === "error") {
    wrapper.classList.add("oracle-chat__message--error")
  }

  if (message.pending) {
    wrapper.classList.add("oracle-chat__message--pending")
  }

  const bubble = document.createElement("div")
  bubble.className = "oracle-chat__bubble"
  if (message.role === "assistant") {
    renderAssistantMessage(bubble, message, options)
  } else {
    bubble.textContent = message.content
  }
  wrapper.appendChild(bubble)

  const time = document.createElement("time")
  time.className = "oracle-chat__timestamp"
  time.setAttribute("datetime", new Date(message.createdAt).toISOString())
  time.textContent = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
  wrapper.appendChild(time)

  return wrapper
}

const clearPendingMarkers = (container: HTMLElement) => {
  container.querySelectorAll(".oracle-chat__message--pending").forEach((element) => {
    element.classList.remove("oracle-chat__message--pending")
  })
}

const scrollHistoryToBottom = (container: HTMLElement, onComplete?: () => void) => {
  window.requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight
    onComplete?.()
  })
}

const sanitiseContent = (value: string): string => value.replace(/[\u0000-\u001f\u007f]/g, " ")

function generateId(): string {
  return Math.random().toString(36).slice(2, 12)
}

const loadRecaptcha = async (siteKey: string): Promise<RecaptchaClient | undefined> => {
  if (!siteKey) {
    return undefined
  }

  const existingClient = (window as unknown as { grecaptcha?: RecaptchaClient }).grecaptcha
  if (existingClient) {
    await new Promise<void>((resolve) => existingClient.ready(resolve))
    return existingClient
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA"))
    document.head.appendChild(script)
  })

  const client = (window as unknown as { grecaptcha?: RecaptchaClient }).grecaptcha
  if (!client) {
    return undefined
  }

  await new Promise<void>((resolve) => client.ready(resolve))
  return client
}

const buildRequestBody = (
  userContent: string,
  state: OracleState,
  config: OracleConfig,
  captchaToken?: string,
  clientMessageId?: string,
) => {
  const history = state.messages
    .filter((message): message is OracleMessage & { role: "user" | "assistant" } =>
      isDialogueRole(message.role) && !message.pending,
    )
    .slice(-config.maxHistory)
    .map((message) => ({ role: message.role, content: message.content }))

  const messages = [...history, { role: "user" as const, content: userContent }]

  const articleTitle = config.article?.title || document.title || undefined
  const articleSlug = config.article?.slug || undefined
  const pagePath = window.location.pathname
  const pageUrl = window.location.href
  const historyCount = history.length
  const sectionCount = (() => {
    try {
      const headings = document.querySelectorAll(".center h2, .center h3, .center h4")
      return headings.length > 0 ? headings.length : undefined
    } catch (error) {
      console.warn("ORA_CLE chat: unable to derive section count", error)
      return undefined
    }
  })()

  const metadata: Record<string, unknown> = {
    origin: window.location.hostname || "710tone.wiki",
    path: pagePath,
    url: pageUrl,
    article: {
      title: articleTitle,
      slug: articleSlug,
    },
    history: {
      includedMessages: historyCount,
      windowSize: config.maxHistory,
      totalMessages: state.messages.length,
    },
    timestamp: new Date().toISOString(),
    channel: "web",
  }

  const payload: OracleRequestPayload = {
    conversationId: state.conversationId ?? null,
    question: userContent,
    messages,
    metadata,
    priority: "medium",
    creativeMode: false,
    channel: "web",
  }

  if (typeof sectionCount === "number") {
    payload.sections = sectionCount
  }

  if (captchaToken) {
    payload.captchaToken = captchaToken
  }

  if (clientMessageId) {
    payload.clientMessageId = clientMessageId
  }

  return payload
}

const tryFetch = async (
  url: string,
  body: OracleRequestPayload,
  config: OracleConfig,
): Promise<FetchResult> => {
  const serializedBody = JSON.stringify(body)

  debugLog("Sending request", {
    url,
    conversationId: body.conversationId,
    messageCount: body.messages.length,
    hasCaptcha: Boolean(body.captchaToken),
  })

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: serializedBody,
    })
  } catch (error) {
    debugLog("Network request failed", {
      error: error instanceof Error ? error.message : String(error),
      request: summariseRequest(body),
      config: snapshotConfig(config),
    })
    throw new Error("ORA_CLE chat: network request failed")
  }

  debugLog("Received response", { status: response.status, ok: response.ok })

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorPayload = await response.json()
      if (typeof errorPayload?.reply === "string" && errorPayload.reply.trim().length > 0) {
        errorMessage = errorPayload.reply.trim()
      } else if (typeof errorPayload?.reason === "string") {
        errorMessage = `${errorMessage}: ${errorPayload.reason}`
      }
    } catch (error) {
      console.warn("ORA_CLE chat: unable to parse error payload", error)
    }

    const errorHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      errorHeaders[key] = value
    })

    debugLog("Response error details", {
      errorMessage,
      headers: errorHeaders,
      request: summariseRequest(body),
      config: snapshotConfig(config),
    })

    throw new Error(errorMessage)
  }

  const payload = (await response.json()) as FetchResult
  return payload
}

type ScrollAnchor = {
  messageId: string
  offset: number
}

type ScrollSnapshot = {
  top: number
  bottomGap: number
  anchor?: ScrollAnchor
}

type RenderStateBehaviour = {
  autoScroll?: "bottom" | "preserve" | "none"
  snapshot?: ScrollSnapshot
  onScrollApplied?: () => void
}

const clampScroll = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const setInstantScrollTop = (container: HTMLElement, value: number, maxScroll: number) => {
  const clamped = clampScroll(value, 0, maxScroll)
  const previousBehaviour = container.style.scrollBehavior
  container.style.scrollBehavior = "auto"
  try {
    container.scrollTop = clamped
  } finally {
    if (previousBehaviour && previousBehaviour.length > 0) {
      container.style.scrollBehavior = previousBehaviour
    } else {
      container.style.removeProperty("scroll-behavior")
    }
  }
}

const findScrollAnchor = (container: HTMLElement): ScrollAnchor | undefined => {
  const messages = Array.from(container.querySelectorAll<HTMLElement>(".oracle-chat__message"))
  if (messages.length === 0) {
    return undefined
  }

  const scrollTop = container.scrollTop
  const viewportBottom = scrollTop + container.clientHeight
  const candidate = messages.find((element) => element.offsetTop + element.offsetHeight > scrollTop + 4)
    ?? messages[messages.length - 1]
  const id = candidate.dataset.messageId
  if (!id) {
    return undefined
  }

  const offset = clampScroll(scrollTop - candidate.offsetTop, 0, candidate.offsetHeight)
  if (candidate.offsetTop + candidate.offsetHeight <= viewportBottom + 2 && viewportBottom >= container.scrollHeight - 2) {
    return undefined
  }
  return { messageId: id, offset }
}

const captureScrollSnapshot = (container: HTMLElement): ScrollSnapshot => {
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
  const top = clampScroll(container.scrollTop, 0, maxScroll)
  const bottomGap = clampScroll(container.scrollHeight - container.clientHeight - top, 0, maxScroll)
  const anchor = findScrollAnchor(container)
  return { top, bottomGap, anchor }
}

const applyScrollSnapshot = (container: HTMLElement, snapshot: ScrollSnapshot | undefined): boolean => {
  if (!snapshot) {
    return false
  }

  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)

  if (snapshot.anchor?.messageId) {
    const target = Array.from(container.querySelectorAll<HTMLElement>(".oracle-chat__message")).find(
      (element) => element.dataset.messageId === snapshot.anchor?.messageId,
    )
    if (target) {
      const desired = target.offsetTop + clampScroll(snapshot.anchor.offset, 0, target.offsetHeight)
      setInstantScrollTop(container, desired, maxScroll)
      return true
    }
  }

  if (snapshot.bottomGap <= 2) {
    setInstantScrollTop(container, maxScroll, maxScroll)
    return true
  }

  setInstantScrollTop(container, snapshot.top, maxScroll)
  return true
}

const restoreScrollSnapshot = (
  container: HTMLElement,
  snapshot: ScrollSnapshot | undefined,
  options?: { attempts?: number; onAfterApply?: () => void },
) => {
  if (!snapshot) {
    options?.onAfterApply?.()
    return
  }

  const maxAttempts = Math.max(1, options?.attempts ?? 6)
  let attempt = 0

  const notify = () => {
    options?.onAfterApply?.()
  }

  const step = () => {
    applyScrollSnapshot(container, snapshot)
    attempt += 1
    if (attempt < maxAttempts) {
      window.requestAnimationFrame(step)
    } else {
      notify()
    }
  }

  step()

  const reapply = () => {
    applyScrollSnapshot(container, snapshot)
    notify()
  }

  if (document.fonts && document.fonts.status === "loading") {
    document.fonts
      .ready
      .then(reapply)
      .catch(() => undefined)
  }

  const pendingImages = Array.from(container.querySelectorAll("img")).filter(
    (element): element is HTMLImageElement => element instanceof HTMLImageElement && !element.complete,
  )
  if (pendingImages.length > 0) {
    pendingImages.forEach((img) => {
      img.addEventListener("load", reapply, { once: true })
      img.addEventListener("error", reapply, { once: true })
    })
  }
}

const renderState = (
  container: HTMLElement,
  state: OracleState,
  options?: MessageRenderOptions,
  behaviour?: RenderStateBehaviour,
) => {
  const behaviourMode = behaviour?.autoScroll ?? "bottom"

  container.innerHTML = ""
  state.messages.forEach((message) => {
    container.appendChild(createMessageElement(message, options))
  })
  if (state.messages.length > 0) {
    if (behaviourMode === "bottom") {
      scrollHistoryToBottom(container, behaviour?.onScrollApplied)
    } else if (behaviourMode === "preserve") {
      restoreScrollSnapshot(container, behaviour?.snapshot, {
        onAfterApply: behaviour?.onScrollApplied,
      })
    }
  } else if (behaviourMode === "preserve") {
    behaviour?.onScrollApplied?.()
  }
}

const setupOracleWidget = () => {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(".oracle-widget"))
  if (roots.length === 0) {
    return
  }

  const supportsEventSource = typeof window.EventSource !== "undefined"
  const activeStreams = new Map<string, EventSource>()
  const pendingContextState = new Map<string, PendingContextState>()

  roots.forEach((root) => {
    if (root.hasAttribute("data-oracle-ready")) {
      return
    }

    root.setAttribute("data-oracle-ready", "true")

    const config = getDatasetConfig(root)
    debugLog("Initialised widget", {
      rootId: root.id || null,
      endpoint: config.endpointPath,
      apiBase: config.apiBaseUrl,
      hasRecaptchaKey: Boolean(config.recaptchaSiteKey),
    })
    const requestUrl = buildRequestUrl(config)
    const storageKey = config.storageKey || DEFAULT_STORAGE_KEY
    const openStateKey = `${storageKey}::open`
    const scrollSnapshotKey = `${storageKey}::scrollSnapshot`

    const readOpenState = () => {
      try {
        return window.localStorage.getItem(openStateKey) === "true"
      } catch (error) {
        console.warn("ORA_CLE chat: unable to read panel state", error)
        return false
      }
    }

    const writeOpenState = (isOpen: boolean) => {
      try {
        if (isOpen) {
          window.localStorage.setItem(openStateKey, "true")
        } else {
          window.localStorage.removeItem(openStateKey)
        }
      } catch (error) {
        console.warn("ORA_CLE chat: unable to persist panel state", error)
      }
    }

    const readScrollSnapshot = (): ScrollSnapshot | undefined => {
      try {
        const raw = window.localStorage.getItem(scrollSnapshotKey)
        if (!raw) {
          return undefined
        }
        const parsed = JSON.parse(raw)
        if (typeof parsed === "number") {
          const value = Number.isFinite(parsed) ? (parsed as number) : 0
          return { top: value, bottomGap: 0 }
        }
        if (typeof parsed?.messageId === "string") {
          const offset = typeof parsed?.offset === "number" ? parsed.offset : 0
          return {
            top: 0,
            bottomGap: 0,
            anchor: { messageId: parsed.messageId, offset },
          }
        }
        const top = typeof parsed?.top === "number" ? parsed.top : undefined
        const bottomGap = typeof parsed?.bottomGap === "number" ? parsed.bottomGap : undefined
        const anchorId = typeof parsed?.anchor?.messageId === "string" ? parsed.anchor.messageId : undefined
        const anchorOffset = typeof parsed?.anchor?.offset === "number" ? parsed.anchor.offset : undefined
        const snapshot: ScrollSnapshot = {
          top: Number.isFinite(top) ? top : 0,
          bottomGap: Number.isFinite(bottomGap) ? bottomGap : 0,
          anchor: anchorId && Number.isFinite(anchorOffset)
            ? { messageId: anchorId, offset: anchorOffset as number }
            : undefined,
        }
        return snapshot
      } catch (error) {
        console.warn("ORA_CLE chat: unable to read scroll snapshot", error)
        return undefined
      }
    }

    const writeScrollSnapshot = (snapshot: ScrollSnapshot | undefined) => {
      try {
        if (snapshot) {
          const payload = JSON.stringify({
            top: snapshot.top,
            bottomGap: snapshot.bottomGap,
            anchor: snapshot.anchor?.messageId
              ? {
                  messageId: snapshot.anchor.messageId,
                  offset: snapshot.anchor.offset,
                }
              : undefined,
          })
          window.localStorage.setItem(scrollSnapshotKey, payload)
        } else {
          window.localStorage.removeItem(scrollSnapshotKey)
        }
      } catch (error) {
        console.warn("ORA_CLE chat: unable to persist scroll snapshot", error)
      }
    }

    const launcher = root.querySelector<HTMLButtonElement>(".oracle-widget__launcher")
    const dialog = root.querySelector<HTMLElement>(".oracle-chat")
    const historyContainer = root.querySelector<HTMLElement>("[data-oracle-history]")
    const form = root.querySelector<HTMLFormElement>("[data-oracle-form]")
    const textArea = root.querySelector<HTMLTextAreaElement>("[data-oracle-input]")
    const sendButton = root.querySelector<HTMLButtonElement>("[data-oracle-send]")
    const closeButton = root.querySelector<HTMLButtonElement>("[data-oracle-action='close']")
    const resetButton = root.querySelector<HTMLButtonElement>("[data-oracle-action='reset']")
    const statusElement = root.querySelector<HTMLElement>("[data-oracle-status-text]")
    const dismissTab = root.querySelector<HTMLButtonElement>("[data-oracle-action='dismiss-tab']")

    if (!launcher || !dialog || !historyContainer || !form || !textArea || !sendButton) {
      console.warn("ORA_CLE chat: widget markup missing expected elements")
      return
    }

    let currentStatus: "online" | "offline" =
      statusElement?.dataset.state === "offline" ? "offline" : "online"

    const setStatus = (state: "online" | "offline") => {
      if (currentStatus === state && statusElement?.dataset.state === state) {
        return
      }

      currentStatus = state

      if (!statusElement) {
        return
      }

      statusElement.textContent = state === "online" ? "Bot status: Online" : "Bot status: Offline"
      statusElement.dataset.state = state
    }

    setStatus(currentStatus)

    let state = loadState(storageKey)
    let lastUserQuestion = [...state.messages]
      .reverse()
      .find((entry) => entry.role === "user")?.content ?? ""

    const updateSendButtonState = () => {
      const hasContent = textArea.value.trim().length > 0
      const isPending = state.messages.some((message) => message.pending)
      sendButton.disabled = !hasContent || isPending
    }

    const autoResize = () => {
      textArea.style.height = "auto"
      textArea.style.height = `${Math.min(textArea.scrollHeight, 240)}px`
    }

    const updateResetButton = () => {
      if (resetButton) {
        resetButton.disabled = state.messages.length === 0
      }
    }

    autoResize()

    let lastSendTimestamp = 0
    let recaptchaClient: RecaptchaClient | undefined
    let activeController: AbortController | undefined

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

    let chatOpen = false
    const shouldRestoreOpen = readOpenState()
    const storedSnapshot = shouldRestoreOpen ? readScrollSnapshot() : undefined
    let preservedSnapshot = storedSnapshot
    const syncScrollSnapshot = () => {
      preservedSnapshot = captureScrollSnapshot(historyContainer)
      writeScrollSnapshot(preservedSnapshot)
    }
    let scrollSyncHandle: number | undefined
    const handleHistoryScroll = () => {
      if (scrollSyncHandle) {
        window.cancelAnimationFrame(scrollSyncHandle)
      }
      scrollSyncHandle = window.requestAnimationFrame(() => {
        syncScrollSnapshot()
        scrollSyncHandle = undefined
      })
    }

    let closingAnimationHandler: ((event: AnimationEvent) => void) | undefined
    let enteringAnimationHandler: ((event: AnimationEvent) => void) | undefined

    const handleFollowUpSelect = (question: string, context: FollowUpContext) => {
      textArea.value = question
      autoResize()
      updateSendButtonState()
      textArea.focus()
      emitAnalytics("oracle:followup-selected", {
        question,
        source: context.source,
        index: context.index,
        conversationId: state.conversationId ?? null,
      })
    }

    const renderOptions: MessageRenderOptions = {
      onFollowUpSelect: handleFollowUpSelect,
      getConversationId: () => state.conversationId ?? null,
    }

    const initialRenderBehaviour: RenderStateBehaviour | undefined = storedSnapshot
      ? { autoScroll: "preserve", snapshot: storedSnapshot, onScrollApplied: syncScrollSnapshot }
      : shouldRestoreOpen
        ? { autoScroll: "bottom", onScrollApplied: syncScrollSnapshot }
        : undefined

    renderState(historyContainer, state, renderOptions, initialRenderBehaviour)
    historyContainer.addEventListener("scroll", handleHistoryScroll, { passive: true })
    updateResetButton()
    updateSendButtonState()

    const closeChat = () => {
      if (!chatOpen && !dialog.classList.contains("oracle-chat--open")) {
        return
      }

      chatOpen = false
      writeOpenState(false)
      launcher.setAttribute("aria-expanded", "false")

      const finalizeClose = () => {
        if (scrollSyncHandle) {
          window.cancelAnimationFrame(scrollSyncHandle)
          scrollSyncHandle = undefined
        }
        preservedSnapshot = undefined
        writeScrollSnapshot(undefined)
        dialog.classList.remove("oracle-chat--closing")
        dialog.classList.remove("oracle-chat--open")
        dialog.classList.remove("oracle-chat--entering")
        dialog.setAttribute("aria-hidden", "true")
        document.body.classList.remove("oracle-chat-active")
        restoreChat(dialog)
        if (document.body.contains(launcher)) {
          launcher.focus()
        }
      }

      if (prefersReducedMotion) {
        if (closingAnimationHandler) {
          dialog.removeEventListener("animationend", closingAnimationHandler)
          closingAnimationHandler = undefined
        }
        if (enteringAnimationHandler) {
          dialog.removeEventListener("animationend", enteringAnimationHandler)
          enteringAnimationHandler = undefined
        }
        finalizeClose()
        return
      }

      const handleAnimationEnd = (event: AnimationEvent) => {
        if (event.target !== dialog || event.animationName !== "oracle-chat-slide-out") {
          return
        }
        dialog.removeEventListener("animationend", handleAnimationEnd)
        closingAnimationHandler = undefined
        finalizeClose()
      }

      if (closingAnimationHandler) {
        dialog.removeEventListener("animationend", closingAnimationHandler)
      }

      dialog.addEventListener("animationend", handleAnimationEnd)
      closingAnimationHandler = handleAnimationEnd
      dialog.classList.remove("oracle-chat--entering")
      dialog.classList.add("oracle-chat--closing")
    }

    const openChat = async (options?: { autoFocus?: boolean; animate?: boolean; preserveScroll?: boolean }) => {
      moveChatToBody(dialog)
      if (closingAnimationHandler) {
        dialog.removeEventListener("animationend", closingAnimationHandler)
        closingAnimationHandler = undefined
      }
      if (enteringAnimationHandler) {
        dialog.removeEventListener("animationend", enteringAnimationHandler)
        enteringAnimationHandler = undefined
      }
      dialog.classList.remove("oracle-chat--closing")
      dialog.classList.remove("oracle-chat--entering")
      const shouldAnimate = (options?.animate ?? true) && !prefersReducedMotion
      dialog.classList.add("oracle-chat--open")
      dialog.setAttribute("aria-hidden", "false")
      launcher.setAttribute("aria-expanded", "true")
      document.body.classList.add("oracle-chat-active")
      chatOpen = true
      state.lastOpenedAt = Date.now()
      persistState(storageKey, state, config.maxHistory)
      writeOpenState(true)

      if (shouldAnimate) {
        const handleEnterEnd = (event: AnimationEvent) => {
          if (event.target !== dialog || event.animationName !== "oracle-chat-slide-in") {
            return
          }
          dialog.removeEventListener("animationend", handleEnterEnd)
          enteringAnimationHandler = undefined
          dialog.classList.remove("oracle-chat--entering")
        }

        dialog.addEventListener("animationend", handleEnterEnd)
        enteringAnimationHandler = handleEnterEnd
        // Trigger enter animation after listener is bound so first frame is captured
        window.requestAnimationFrame(() => {
          dialog.classList.add("oracle-chat--entering")
        })
      }

      if (config.recaptchaSiteKey && !recaptchaClient) {
        try {
          recaptchaClient = await loadRecaptcha(config.recaptchaSiteKey)
        } catch (error) {
          console.warn("ORA_CLE chat: unable to load reCAPTCHA", error)
        }
      }

      const shouldFocus = options?.autoFocus ?? true
      const shouldPreserveScroll = Boolean(options?.preserveScroll)

      const applyScrollBehaviour = () => {
        if (shouldPreserveScroll && preservedSnapshot) {
          restoreScrollSnapshot(historyContainer, preservedSnapshot, {
            onAfterApply: syncScrollSnapshot,
          })
        } else if (shouldPreserveScroll) {
          window.requestAnimationFrame(() => {
            syncScrollSnapshot()
          })
        } else {
          scrollHistoryToBottom(historyContainer, syncScrollSnapshot)
        }
      }

      applyScrollBehaviour()

      window.requestAnimationFrame(() => {
        if (shouldFocus) {
          textArea.focus()
        }
        if (!shouldPreserveScroll) {
          applyScrollBehaviour()
        }
      })
    }

    const parseEventData = (raw: string | null): Record<string, unknown> | undefined => {
      if (!raw) {
        return undefined
      }
      try {
        const parsed = JSON.parse(raw)
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined
      } catch (error) {
        console.warn("ORA_CLE chat: unable to parse stream payload", error)
        return undefined
      }
    }

    const renderPendingContext = (messageId: string) => {
      const container = historyContainer.querySelector<HTMLElement>(`[data-oracle-pending-context="${messageId}"]`)
      if (!container) {
        return
      }

      const state = pendingContextState.get(messageId)
      if (!state) {
        container.hidden = true
        container.textContent = ""
        return
      }

      container.hidden = false
      container.textContent = ""

      if (state.titles.length > 0) {
        container.append(document.createTextNode("Looking through "))
        state.titles.forEach((title, index) => {
          if (index > 0) {
            container.append(document.createTextNode(", "))
          }
          const span = document.createElement("span")
          span.className = "oracle-chat__pending-context-item"
          span.textContent = title
          container.appendChild(span)
        })
        container.append(document.createTextNode(" …"))
        return
      }

      container.textContent = state.empty ? "Still scanning the archive…" : "Scanning the archive…"
    }

    const ensurePendingState = (messageId: string): PendingContextState => {
      const existing = pendingContextState.get(messageId)
      if (existing) {
        return existing
      }
      const next: PendingContextState = {
        titles: [],
        empty: false,
        lastUpdated: Date.now(),
      }
      pendingContextState.set(messageId, next)
      return next
    }

    const recordContextHit = (messageId: string, rawTitle: unknown) => {
      const title = toTrimmedString(rawTitle)
      if (!title) {
        return
      }
      const state = ensurePendingState(messageId)
      const lower = title.toLowerCase()
      if (state.titles.some((entry) => entry.toLowerCase() === lower)) {
        state.lastUpdated = Date.now()
        return
      }
      const updated = [...state.titles, title]
      if (updated.length > 5) {
        updated.shift()
      }
      state.titles = updated
      state.empty = false
      state.lastUpdated = Date.now()
      renderPendingContext(messageId)
    }

    const markContextEmpty = (messageId: string) => {
      const state = ensurePendingState(messageId)
      if (state.titles.length > 0) {
        return
      }
      state.empty = true
      state.lastUpdated = Date.now()
      renderPendingContext(messageId)
    }

    const stopContextStream = (messageId: string) => {
      const source = activeStreams.get(messageId)
      if (source) {
        source.close()
        activeStreams.delete(messageId)
      }
      pendingContextState.delete(messageId)
      renderPendingContext(messageId)
    }

    const startContextStream = (messageId: string, conversationId: string | undefined) => {
      if (!supportsEventSource || !config.contextStreamPath || activeStreams.has(messageId)) {
        return
      }

      try {
        const streamUrl = buildStreamUrl(config, conversationId, messageId)
        const source = new EventSource(streamUrl, { withCredentials: true })

        ensurePendingState(messageId)
        renderPendingContext(messageId)

        source.addEventListener("context-start", () => {
          pendingContextState.set(messageId, {
            titles: [],
            empty: false,
            lastUpdated: Date.now(),
          })
          renderPendingContext(messageId)
        })

        source.addEventListener("context-hit", (event) => {
          const data = parseEventData((event as MessageEvent<string>).data)
          recordContextHit(messageId, data?.title ?? data?.slug ?? data?.label)
        })

        source.addEventListener("context-empty", () => {
          markContextEmpty(messageId)
        })

        source.addEventListener("complete", () => {
          stopContextStream(messageId)
        })

        source.addEventListener("error", (event) => {
          const messageEvent = event as MessageEvent<string>
          const parsed = typeof messageEvent.data === "string" ? parseEventData(messageEvent.data) : undefined
          if (parsed?.message && typeof parsed.message === "string") {
            console.warn("ORA_CLE chat: context stream error", parsed.message)
          } else {
            console.warn("ORA_CLE chat: context stream error", event)
          }
          stopContextStream(messageId)
        })

        activeStreams.set(messageId, source)
      } catch (error) {
        console.warn("ORA_CLE chat: unable to open context stream", error)
      }
    }

    const resetChat = () => {
      Array.from(activeStreams.keys()).forEach((messageId) => stopContextStream(messageId))
      pendingContextState.clear()
      state = { messages: [] }
      lastUserQuestion = ""
      persistState(storageKey, state, config.maxHistory)
      renderState(historyContainer, state, renderOptions, { autoScroll: "none" })
      historyContainer.scrollTop = 0
      preservedSnapshot = undefined
      writeScrollSnapshot(undefined)
      updateResetButton()
      updateSendButtonState()
      autoResize()
    }

    const appendMessage = (message: OracleMessage) => {
      state.messages = [...state.messages, message]
      historyContainer.appendChild(createMessageElement(message, renderOptions))
      scrollHistoryToBottom(historyContainer, syncScrollSnapshot)
      persistState(storageKey, state, config.maxHistory)
      updateResetButton()
    }

    const replacePendingWith = (message: OracleMessage) => {
      stopContextStream(message.id)
      state.messages = state.messages.map((entry) => (entry.pending ? message : entry))
      renderState(historyContainer, state, renderOptions, {
        autoScroll: "bottom",
        onScrollApplied: syncScrollSnapshot,
      })
      persistState(storageKey, state, config.maxHistory)
      updateResetButton()
    }


    const showError = (error: unknown) => {
      const content = error instanceof Error ? error.message : "Something went wrong. Please try again."
      const errorMessage: OracleMessage = {
        id: generateId(),
        role: "error",
        content,
        createdAt: Date.now(),
      }
      appendMessage(errorMessage)
      updateSendButtonState()
    }

    const sendMessage = async () => {
      const trimmed = sanitiseContent(textArea.value.trim())
      if (!trimmed) {
        return
      }

      const now = Date.now()
      if (now - lastSendTimestamp < SEND_COOLDOWN_MS) {
        return
      }

      lastSendTimestamp = now
      lastUserQuestion = trimmed

      if (!state.conversationId) {
        state.conversationId = generateId()
      }

      const userMessage: OracleMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        createdAt: now,
      }

      appendMessage(userMessage)
      emitAnalytics("oracle:question-submitted", {
        conversationId: state.conversationId ?? null,
        questionLength: trimmed.length,
        articleSlug: config.article?.slug ?? null,
      })

      textArea.value = ""
      autoResize()

      const pendingReply: OracleMessage = {
        id: generateId(),
        role: "assistant",
        content: "The ORA_CLE is thinking",
        createdAt: Date.now(),
        pending: true,
      }

      pendingReply.promptContext = trimmed

      appendMessage(pendingReply)
      startContextStream(pendingReply.id, state.conversationId)
      updateSendButtonState()

      if (activeController) {
        activeController.abort()
      }

      const controller = new AbortController()
      activeController = controller

      let captchaToken: string | undefined
      if (config.recaptchaSiteKey && recaptchaClient) {
        try {
          captchaToken = await recaptchaClient.execute(config.recaptchaSiteKey, { action: RECAPTCHA_ACTION })
        } catch (error) {
          console.warn("ORA_CLE chat: reCAPTCHA execution failed", error)
        }
      }

    const body = buildRequestBody(trimmed, state, config, captchaToken, pendingReply.id)

      try {
        const result = await tryFetch(requestUrl, body, config)
        if (controller.signal.aborted) {
          return
        }

        if (result.conversationId) {
          state.conversationId = result.conversationId
        }

        let replyText = result.reply?.trim()
        if (!replyText && Array.isArray(result.messages) && result.messages.length > 0) {
          const lastAssistant = result.messages.reverse().find((message) => message.role === "assistant")
          replyText = lastAssistant?.content?.trim()
        }

        if (!replyText) {
          replyText = "I do not have an answer right now, please try another question."
        }

        const webPayload = parseWebPayload(result.webPayload)
        const disclaimers = toTrimmedStringArray(result.disclaimers)

        const assistantMessage: OracleMessage = {
          id: pendingReply.id,
          role: "assistant",
          content: replyText,
          createdAt: Date.now(),
          webPayload: webPayload,
          disclaimers: disclaimers,
          rawReply: replyText,
          promptContext: pendingReply.promptContext ?? lastUserQuestion,
        }

        replacePendingWith(assistantMessage)
        if (currentStatus !== "online") {
          setStatus("online")
        }
        updateSendButtonState()

        const sourcesCount = webPayload?.sources?.length ?? 0
        const snippetCount = webPayload?.contextSnippets?.length ?? 0
        const followUpCount = webPayload?.followUpQuestions?.length ?? 0

        emitAnalytics("oracle:response-received", {
          conversationId: state.conversationId ?? null,
          hasWebPayload: Boolean(webPayload),
          sourceCount: sourcesCount,
          snippetCount,
          followUpCount,
        })

        if (followUpCount > 0) {
          emitAnalytics("oracle:followups-presented", {
            conversationId: state.conversationId ?? null,
            followUpCount,
          })
        }

        if (sourcesCount === 0 && snippetCount === 0) {
          emitAnalytics("oracle:fallback-presented", {
            conversationId: state.conversationId ?? null,
          })
        }
      } catch (error) {
        console.warn("ORA_CLE chat: request failed", error)
        debugLog("Send message error", {
          error: error instanceof Error ? error.message : String(error),
          request: summariseRequest(body),
          config: snapshotConfig(config),
        })
        stopContextStream(pendingReply.id)
        state.messages = state.messages.filter((entry) => !entry.pending)
        renderState(historyContainer, state, renderOptions, {
          autoScroll: "bottom",
          onScrollApplied: syncScrollSnapshot,
        })
        persistState(storageKey, state, config.maxHistory)
        showError(error)
        if (
          error instanceof Error &&
          (/network request failed/i.test(error.message) || /failed to fetch/i.test(error.message))
        ) {
          setStatus("offline")
        }
      }
    }

    const handleLauncherClick = () => {
      openChat().catch((error) => {
        console.warn("ORA_CLE chat: unable to open", error)
      })
    }

    const handleCloseClick = () => {
      closeChat()
    }

    const handleResetClick = () => {
      resetChat()
    }

    const handleFormSubmit = (event: Event) => {
      event.preventDefault()
      sendMessage().catch((error) => {
        console.warn("ORA_CLE chat: send failed", error)
        updateSendButtonState()
      })
    }

    const handleInput = () => {
      autoResize()
      updateSendButtonState()
    }

    const handleTextareaKeydown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        sendMessage().catch((error) => {
          console.warn("ORA_CLE chat: send failed", error)
          updateSendButtonState()
        })
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dialog.classList.contains("oracle-chat--open")) {
        closeChat()
      }
    }

    launcher.addEventListener("click", handleLauncherClick)
    closeButton?.addEventListener("click", handleCloseClick)
    dismissTab?.addEventListener("click", handleCloseClick)
    resetButton?.addEventListener("click", handleResetClick)
    form.addEventListener("submit", handleFormSubmit)
    textArea.addEventListener("input", handleInput)
    textArea.addEventListener("keydown", handleTextareaKeydown)
    window.addEventListener("keydown", handleEscapeKey)

    if (shouldRestoreOpen) {
      window.requestAnimationFrame(() => {
        openChat({ autoFocus: false, animate: false, preserveScroll: true }).catch((error) => {
          console.warn("ORA_CLE chat: unable to restore open state", error)
          writeOpenState(false)
        })
      })
    }

    window.addCleanup?.(() => {
      launcher.removeEventListener("click", handleLauncherClick)
      closeButton?.removeEventListener("click", handleCloseClick)
      dismissTab?.removeEventListener("click", handleCloseClick)
      resetButton?.removeEventListener("click", handleResetClick)
      form.removeEventListener("submit", handleFormSubmit)
      textArea.removeEventListener("input", handleInput)
      textArea.removeEventListener("keydown", handleTextareaKeydown)
      window.removeEventListener("keydown", handleEscapeKey)
      if (closingAnimationHandler) {
        dialog.removeEventListener("animationend", closingAnimationHandler)
        closingAnimationHandler = undefined
      }
      if (enteringAnimationHandler) {
        dialog.removeEventListener("animationend", enteringAnimationHandler)
        enteringAnimationHandler = undefined
      }
      if (scrollSyncHandle) {
        window.cancelAnimationFrame(scrollSyncHandle)
        scrollSyncHandle = undefined
      }
      historyContainer.removeEventListener("scroll", handleHistoryScroll)
      activeController?.abort()
      chatOpen = false
      dialog.classList.remove("oracle-chat--open", "oracle-chat--closing", "oracle-chat--entering")
      dialog.setAttribute("aria-hidden", "true")
      document.body.classList.remove("oracle-chat-active")
      restoreChat(dialog)
    })
  })
}

const init = () => {
  setupOracleWidget()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true })
} else {
  init()
}

document.addEventListener("nav", init)
