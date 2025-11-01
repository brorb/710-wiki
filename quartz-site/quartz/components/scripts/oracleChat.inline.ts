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
  source: "suggestion" | "fallback"
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

type OracleState = {
  conversationId?: string
  messages: OracleMessage[]
  lastOpenedAt?: number
}

type OracleConfig = {
  apiBaseUrl: string
  endpointPath: string
  storageKey: string
  maxHistory: number
  recaptchaSiteKey?: string
  webApiKey?: string
  oracleKeyId?: string
  oracleSigningSecret?: string
  webApiKeyPlaceholder?: boolean
  oracleKeyIdPlaceholder?: boolean
  oracleSigningSecretPlaceholder?: boolean
  article?: {
    title?: string
    slug?: string
  }
}

type OracleRequestPayload = {
  conversationId: string | null
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

const textEncoder = new TextEncoder()
const hmacKeyCache = new Map<string, Promise<CryptoKey>>()

const ensureSubtleCrypto = () => {
  const subtle = window.crypto?.subtle
  if (!subtle) {
    throw new Error("ORA_CLE chat: secure context unavailable for request signing")
  }
  return subtle
}

const getHmacKey = (secret: string) => {
  let cached = hmacKeyCache.get(secret)
  if (!cached) {
    const subtle = ensureSubtleCrypto()
    const keyData = textEncoder.encode(secret)
    cached = subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    hmacKeyCache.set(secret, cached)
  }
  return cached
}

const createSignature = async (secret: string, payload: string) => {
  const subtle = ensureSubtleCrypto()
  const cryptoKey = await getHmacKey(secret)
  const signature = await subtle.sign("HMAC", cryptoKey, textEncoder.encode(payload))
  const bytes = new Uint8Array(signature)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

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

const redactToken = (value?: string) => {
  if (!value) {
    return null
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const snapshotConfig = (config: OracleConfig) => ({
  apiBaseUrl: config.apiBaseUrl || null,
  endpointPath: config.endpointPath,
  storageKey: config.storageKey,
  maxHistory: config.maxHistory,
  hasRecaptcha: Boolean(config.recaptchaSiteKey),
  webApiKeyPlaceholder: Boolean(config.webApiKeyPlaceholder),
  oracleKeyIdPlaceholder: Boolean(config.oracleKeyIdPlaceholder),
  oracleSigningSecretPlaceholder: Boolean(config.oracleSigningSecretPlaceholder),
  webApiKeyPreview: redactToken(config.webApiKey),
  oracleKeyIdPreview: redactToken(config.oracleKeyId),
  oracleSigningSecretPreview: redactToken(config.oracleSigningSecret),
})

const summariseRequest = (payload: OracleRequestPayload) => ({
  conversationId: payload.conversationId,
  questionPreview: payload.question.slice(0, 80),
  messageRoles: payload.messages.map((message) => message.role),
  metadataKeys: Object.keys(payload.metadata || {}),
  hasCaptcha: Boolean(payload.captchaToken),
})

const isPlaceholderValue = (value?: string) => {
  if (!value) {
    return false
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return false
  }

  if (trimmed.startsWith("${{") && trimmed.endsWith("}}")) {
    return true
  }

  if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
    return true
  }

  return false
}

const normaliseCredential = (raw?: string) => {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return { value: undefined as string | undefined, placeholder: false }
  }

  if (isPlaceholderValue(trimmed)) {
    return { value: undefined, placeholder: true }
  }

  return { value: trimmed, placeholder: false }
}

const getDatasetConfig = (root: HTMLElement): OracleConfig => {
  const {
    oracleApiBase = "",
    oracleEndpoint = DEFAULT_ENDPOINT,
    oracleStorageKey,
    oracleMaxHistory,
    oracleRecaptchaKey,
    oracleArticleTitle,
    oracleArticleSlug,
    oracleWebKey,
    oracleSigningKey,
    oracleSigningSecret,
  } = root.dataset

  const webKey = normaliseCredential(oracleWebKey)
  const signingKey = normaliseCredential(oracleSigningKey)
  const signingSecret = normaliseCredential(oracleSigningSecret)

  const storageKey = oracleStorageKey?.trim() || DEFAULT_STORAGE_KEY
  const maxHistory = Number.parseInt(oracleMaxHistory ?? "", 10)
  const safeMaxHistory = Number.isFinite(maxHistory) && maxHistory > 0 ? maxHistory : DEFAULT_MAX_HISTORY

  return {
    apiBaseUrl: oracleApiBase?.trim() || "",
    endpointPath: oracleEndpoint?.trim() || DEFAULT_ENDPOINT,
    storageKey,
    maxHistory: safeMaxHistory,
    recaptchaSiteKey: oracleRecaptchaKey?.trim() || undefined,
    webApiKey: webKey.value,
    oracleKeyId: signingKey.value,
    oracleSigningSecret: signingSecret.value,
    webApiKeyPlaceholder: webKey.placeholder,
    oracleKeyIdPlaceholder: signingKey.placeholder,
    oracleSigningSecretPlaceholder: signingSecret.placeholder,
    article: {
      title: oracleArticleTitle?.trim() || undefined,
      slug: oracleArticleSlug?.trim() || undefined,
    },
  }
}

const buildRequestUrl = (config: OracleConfig): string => {
  const { apiBaseUrl, endpointPath } = config
  const trimmedEndpoint = endpointPath.startsWith("/") || endpointPath.startsWith("http")
    ? endpointPath
    : `/${endpointPath}`

  if (!apiBaseUrl) {
    if (trimmedEndpoint.startsWith("http")) {
      return trimmedEndpoint
    }

    return `${window.location.origin}${trimmedEndpoint}`
  }

  if (apiBaseUrl.startsWith("http")) {
    const base = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl
    return trimmedEndpoint.startsWith("/") ? `${base}${trimmedEndpoint}` : `${base}/${trimmedEndpoint}`
  }

  const normalisedBase = apiBaseUrl.startsWith("/") ? apiBaseUrl : `/${apiBaseUrl}`
  return `${window.location.origin}${normalisedBase.endsWith("/") ? normalisedBase.slice(0, -1) : normalisedBase}${
    trimmedEndpoint.startsWith("/") ? trimmedEndpoint : `/${trimmedEndpoint}`
  }`
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

  if (leadText) {
    bubble.appendChild(createHelperElement("p", "oracle-chat__answer-lead", leadText))
  }

  if (secondaryText) {
    bubble.appendChild(createHelperElement("p", "oracle-chat__answer-body", secondaryText))
  } else if (!payload && fallbackText) {
    bubble.appendChild(createHelperElement("p", "oracle-chat__answer-body", fallbackText))
  }

  const addLinkAnalytics = (kind: "snippet" | "source", url?: string, index?: number) => {
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

  if (payload?.contextSnippets?.length) {
    const snippetList = document.createElement("div")
    snippetList.className = "oracle-chat__snippet-list"

    payload.contextSnippets.forEach((snippet, index) => {
      const card = document.createElement("article")
      card.className = "oracle-chat__snippet"

      const headingText = snippet.title ?? snippet.alias
      if (headingText) {
        const heading = createHelperElement("h3", "oracle-chat__snippet-title", headingText)
        card.appendChild(heading)
      }

      if (snippet.summary) {
        card.appendChild(createHelperElement("p", "oracle-chat__snippet-summary", snippet.summary))
      }

      if (snippet.url) {
        const link = document.createElement("a")
        const linkLabel = snippet.url && snippet.title ? snippet.title : snippet.url
        link.className = "oracle-chat__snippet-link"
        link.href = snippet.url
        link.rel = "noopener noreferrer"
        link.target = "_blank"
        link.textContent = linkLabel
        link.addEventListener("click", () => addLinkAnalytics("snippet", snippet.url, index))
        card.appendChild(link)
      }

      const metaParts: string[] = []
      if (snippet.section) {
        metaParts.push(snippet.section)
      }
      if (snippet.strength) {
        metaParts.push(snippet.strength)
      }
      if (snippet.alias && snippet.alias !== snippet.title) {
        metaParts.push(snippet.alias)
      }

      if (metaParts.length > 0) {
        card.appendChild(createHelperElement("p", "oracle-chat__snippet-meta", metaParts.join(" • ")))
      }

      snippetList.appendChild(card)
    })

    bubble.appendChild(snippetList)
  }

  if (payload?.sources?.length) {
    const sourcesSection = document.createElement("section")
    sourcesSection.className = "oracle-chat__sources"
    sourcesSection.appendChild(createHelperElement("h3", "oracle-chat__sources-heading", "Sources"))

    const list = document.createElement("ul")
    list.className = "oracle-chat__source-list"

    payload.sources.forEach((source, index) => {
      if (!source.url && !source.title && !source.description) {
        return
      }

      const item = document.createElement("li")
      item.className = "oracle-chat__source-item"

      const linkText = source.title ?? source.url ?? "View source"

      if (source.url) {
        const anchor = document.createElement("a")
        anchor.className = "oracle-chat__source-link"
        anchor.href = source.url
        anchor.target = "_blank"
        anchor.rel = "noopener noreferrer"
        anchor.textContent = linkText
        anchor.addEventListener("click", () => addLinkAnalytics("source", source.url ?? undefined, index))
        item.appendChild(anchor)
      } else {
        item.appendChild(createHelperElement("span", "oracle-chat__source-label", linkText))
      }

      const detailParts: string[] = []
      if (source.description) {
        detailParts.push(source.description)
      }
      if (source.section) {
        detailParts.push(source.section)
      }
      if (source.strength) {
        detailParts.push(source.strength)
      }

      if (detailParts.length > 0) {
        item.appendChild(createHelperElement("p", "oracle-chat__source-meta", detailParts.join(" • ")))
      }

      list.appendChild(item)
    })

    if (list.children.length > 0) {
      sourcesSection.appendChild(list)
      bubble.appendChild(sourcesSection)
    }
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

  const lacksLinks = !(payload?.sources?.length || payload?.contextSnippets?.length)
  if (lacksLinks) {
    const fallbackBlock = document.createElement("div")
    fallbackBlock.className = "oracle-chat__fallback"
    fallbackBlock.appendChild(
      createHelperElement(
        "p",
        "oracle-chat__fallback-text",
        "I couldn’t surface specific links for this answer. Consider asking for more detail or exploring related pages.",
      ),
    )

    const suggestionQuestion = message.promptContext
      ? `Can you point me to sources for "${message.promptContext}"?`
      : "Can you point me to sources for this topic?"
    const exploreQuestion = "Suggest another topic I should investigate next."

    const fallbackButtons = document.createElement("div")
    fallbackButtons.className = "oracle-chat__fallback-buttons"

    const addFallbackButton = (label: string, question: string, index: number) => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "oracle-chat__fallback-button"
      button.textContent = label
      button.addEventListener("click", () => {
        options?.onFollowUpSelect?.(question, { source: "fallback", index })
      })
      fallbackButtons.appendChild(button)
    }

    addFallbackButton("Ask for sources", suggestionQuestion, 0)
    addFallbackButton("Explore another topic", exploreQuestion, 1)

    fallbackBlock.appendChild(fallbackButtons)
    bubble.appendChild(fallbackBlock)
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

const scrollHistoryToBottom = (container: HTMLElement) => {
  window.requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight
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

  return payload
}

const tryFetch = async (
  url: string,
  body: OracleRequestPayload,
  config: OracleConfig,
): Promise<FetchResult> => {
  if (config.webApiKeyPlaceholder || config.oracleKeyIdPlaceholder || config.oracleSigningSecretPlaceholder) {
    debugLog("Credentials unresolved placeholder", {
      config: snapshotConfig(config),
    })
    throw new Error(
      "ORA_CLE chat: API credentials unresolved placeholder; replace ${{...}} with the actual secret in your .env",
    )
  }

  if (!config.webApiKey || !config.oracleKeyId || !config.oracleSigningSecret) {
    debugLog("Missing credentials", {
      hasWebApiKey: Boolean(config.webApiKey),
      hasOracleKeyId: Boolean(config.oracleKeyId),
      hasOracleSigningSecret: Boolean(config.oracleSigningSecret),
      webApiKeyPreview: redactToken(config.webApiKey),
      oracleKeyIdPreview: redactToken(config.oracleKeyId),
      oracleSigningSecretPreview: redactToken(config.oracleSigningSecret),
    })
    throw new Error("ORA_CLE chat: missing API credentials")
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const serializedBody = JSON.stringify(body)
  const signaturePayload = `${timestamp}.${serializedBody}`
  const signature = await createSignature(config.oracleSigningSecret, signaturePayload)

  debugLog("Sending request", {
    url,
    conversationId: body.conversationId,
    messageCount: body.messages.length,
    hasCaptcha: Boolean(body.captchaToken),
    timestamp,
  })

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Web-Api-Key": config.webApiKey,
        "X-Oracle-Key": config.oracleKeyId,
        "X-Oracle-Timestamp": timestamp,
        "X-Oracle-Signature": signature,
        "X-Oracle-Channel": "web",
      },
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

const renderState = (container: HTMLElement, state: OracleState, options?: MessageRenderOptions) => {
  container.innerHTML = ""
  state.messages.forEach((message) => {
    container.appendChild(createMessageElement(message, options))
  })
  if (state.messages.length > 0) {
    scrollHistoryToBottom(container)
  }
}

const setupOracleWidget = () => {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(".oracle-widget"))
  if (roots.length === 0) {
    return
  }

  roots.forEach((root) => {
    if (root.hasAttribute("data-oracle-ready")) {
      return
    }

    root.setAttribute("data-oracle-ready", "true")

    const config = getDatasetConfig(root)
    debugLog("Initialised widget", {
      rootId: root.id || null,
      hasWebApiKey: Boolean(config.webApiKey),
      hasOracleKeyId: Boolean(config.oracleKeyId),
      hasOracleSigningSecret: Boolean(config.oracleSigningSecret),
      webApiKeyPlaceholder: Boolean(config.webApiKeyPlaceholder),
      oracleKeyIdPlaceholder: Boolean(config.oracleKeyIdPlaceholder),
      oracleSigningSecretPlaceholder: Boolean(config.oracleSigningSecretPlaceholder),
      endpoint: config.endpointPath,
      apiBase: config.apiBaseUrl,
    })
    const requestUrl = buildRequestUrl(config)
    const storageKey = config.storageKey || DEFAULT_STORAGE_KEY

    const launcher = root.querySelector<HTMLButtonElement>(".oracle-widget__launcher")
    const overlay = root.querySelector<HTMLElement>(".oracle-chat__overlay")
    const dialog = root.querySelector<HTMLElement>(".oracle-chat")
    const historyContainer = root.querySelector<HTMLElement>("[data-oracle-history]")
    const form = root.querySelector<HTMLFormElement>("[data-oracle-form]")
    const textArea = root.querySelector<HTMLTextAreaElement>("[data-oracle-input]")
    const sendButton = root.querySelector<HTMLButtonElement>("[data-oracle-send]")
    const closeButton = root.querySelector<HTMLButtonElement>("[data-oracle-action='close']")
    const resetButton = root.querySelector<HTMLButtonElement>("[data-oracle-action='reset']")

    if (!launcher || !overlay || !dialog || !historyContainer || !form || !textArea || !sendButton) {
      console.warn("ORA_CLE chat: widget markup missing expected elements")
      return
    }

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

    let chatOpen = false

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

    renderState(historyContainer, state, renderOptions)
    updateResetButton()
    updateSendButtonState()

    const closeChat = () => {
    if (!chatOpen) {
      return
    }

    chatOpen = false
    dialog.classList.remove("oracle-chat--open")
    dialog.setAttribute("aria-hidden", "true")
    launcher.setAttribute("aria-expanded", "false")
    document.body.classList.remove("oracle-chat-active")
    restoreChat(dialog)
    if (document.body.contains(launcher)) {
      launcher.focus()
    }
    }

    const openChat = async () => {
    moveChatToBody(dialog)
    dialog.classList.add("oracle-chat--open")
    dialog.setAttribute("aria-hidden", "false")
    launcher.setAttribute("aria-expanded", "true")
    document.body.classList.add("oracle-chat-active")
    chatOpen = true
    state.lastOpenedAt = Date.now()
    persistState(storageKey, state, config.maxHistory)

    if (config.recaptchaSiteKey && !recaptchaClient) {
      try {
        recaptchaClient = await loadRecaptcha(config.recaptchaSiteKey)
      } catch (error) {
        console.warn("ORA_CLE chat: unable to load reCAPTCHA", error)
      }
    }

      window.requestAnimationFrame(() => {
        textArea.focus()
        scrollHistoryToBottom(historyContainer)
      })
    }

    const resetChat = () => {
      state = { messages: [] }
      lastUserQuestion = ""
      persistState(storageKey, state, config.maxHistory)
      renderState(historyContainer, state, renderOptions)
      updateResetButton()
      updateSendButtonState()
      autoResize()
    }

    const appendMessage = (message: OracleMessage) => {
      state.messages = [...state.messages, message]
      historyContainer.appendChild(createMessageElement(message, renderOptions))
      scrollHistoryToBottom(historyContainer)
      persistState(storageKey, state, config.maxHistory)
      updateResetButton()
    }

    const replacePendingWith = (message: OracleMessage) => {
      state.messages = state.messages.map((entry) => (entry.pending ? message : entry))
      renderState(historyContainer, state, renderOptions)
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

      const body = buildRequestBody(trimmed, state, config, captchaToken)

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
        state.messages = state.messages.filter((entry) => !entry.pending)
        renderState(historyContainer, state, renderOptions)
        persistState(storageKey, state, config.maxHistory)
        showError(error)
      }
    }

    const handleLauncherClick = () => {
    openChat().catch((error) => {
      console.warn("ORA_CLE chat: unable to open", error)
    })
    }

    const handleOverlayClick = () => {
    closeChat()
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
    overlay.addEventListener("click", handleOverlayClick)
    closeButton?.addEventListener("click", handleCloseClick)
    resetButton?.addEventListener("click", handleResetClick)
    form.addEventListener("submit", handleFormSubmit)
    textArea.addEventListener("input", handleInput)
    textArea.addEventListener("keydown", handleTextareaKeydown)
    window.addEventListener("keydown", handleEscapeKey)

    window.addCleanup?.(() => {
      launcher.removeEventListener("click", handleLauncherClick)
      overlay.removeEventListener("click", handleOverlayClick)
      closeButton?.removeEventListener("click", handleCloseClick)
      resetButton?.removeEventListener("click", handleResetClick)
      form.removeEventListener("submit", handleFormSubmit)
      textArea.removeEventListener("input", handleInput)
      textArea.removeEventListener("keydown", handleTextareaKeydown)
      window.removeEventListener("keydown", handleEscapeKey)
      activeController?.abort()
      if (chatOpen) {
        dialog.classList.remove("oracle-chat--open")
        dialog.setAttribute("aria-hidden", "true")
      }
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
