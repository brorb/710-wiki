type OracleRole = "user" | "assistant" | "system" | "error"

type OracleMessage = {
  id: string
  role: OracleRole
  content: string
  createdAt: number
  pending?: boolean
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

  const storageKey = oracleStorageKey?.trim() || DEFAULT_STORAGE_KEY
  const maxHistory = Number.parseInt(oracleMaxHistory ?? "", 10)
  const safeMaxHistory = Number.isFinite(maxHistory) && maxHistory > 0 ? maxHistory : DEFAULT_MAX_HISTORY

  return {
    apiBaseUrl: oracleApiBase?.trim() || "",
    endpointPath: oracleEndpoint?.trim() || DEFAULT_ENDPOINT,
    storageKey,
    maxHistory: safeMaxHistory,
    recaptchaSiteKey: oracleRecaptchaKey?.trim() || undefined,
    webApiKey: oracleWebKey?.trim() || undefined,
    oracleKeyId: oracleSigningKey?.trim() || undefined,
    oracleSigningSecret: oracleSigningSecret?.trim() || undefined,
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

    const parsed = JSON.parse(raw) as OracleState
    if (!Array.isArray(parsed.messages)) {
      return { messages: [] }
    }

    return {
      conversationId: parsed.conversationId,
      lastOpenedAt: parsed.lastOpenedAt,
      messages: parsed.messages.filter((entry) => typeof entry?.content === "string" && entry.content.length > 0),
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
      })),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (error) {
    console.warn("ORA_CLE chat: unable to persist chat state", error)
  }
}

const createMessageElement = (message: OracleMessage): HTMLElement => {
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
  bubble.textContent = message.content
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

const generateId = (): string => Math.random().toString(36).slice(2, 12)

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
      isDialogueRole(message.role),
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
  }

  const payload: OracleRequestPayload = {
    conversationId: state.conversationId ?? null,
    question: userContent,
    messages,
    metadata,
    priority: "medium",
    creativeMode: false,
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
  if (!config.webApiKey || !config.oracleKeyId || !config.oracleSigningSecret) {
    debugLog("Missing credentials", {
      hasWebApiKey: Boolean(config.webApiKey),
      hasOracleKeyId: Boolean(config.oracleKeyId),
      hasOracleSigningSecret: Boolean(config.oracleSigningSecret),
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Web-Api-Key": config.webApiKey,
      "X-Oracle-Key": config.oracleKeyId,
      "X-Oracle-Timestamp": timestamp,
      "X-Oracle-Signature": signature,
    },
    body: serializedBody,
  })

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

    debugLog("Response error details", { errorMessage })

    throw new Error(errorMessage)
  }

  const payload = (await response.json()) as FetchResult
  return payload
}

const renderState = (container: HTMLElement, state: OracleState) => {
  container.innerHTML = ""
  state.messages.forEach((message) => {
    container.appendChild(createMessageElement(message))
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
  renderState(historyContainer, state)

  if (resetButton) {
    resetButton.disabled = state.messages.length === 0
  }

  const updateSendButtonState = () => {
    const hasContent = textArea.value.trim().length > 0
    const isPending = state.messages.some((message) => message.pending)
    sendButton.disabled = !hasContent || isPending
  }

  const autoResize = () => {
    textArea.style.height = "auto"
    textArea.style.height = `${Math.min(textArea.scrollHeight, 240)}px`
  }

  autoResize()
  updateSendButtonState()

  let lastSendTimestamp = 0
  let recaptchaClient: RecaptchaClient | undefined
  let activeController: AbortController | undefined

  let chatOpen = false

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
    persistState(storageKey, state, config.maxHistory)
    renderState(historyContainer, state)
    if (resetButton) {
      resetButton.disabled = true
    }
    updateSendButtonState()
    autoResize()
  }

  const appendMessage = (message: OracleMessage) => {
    state.messages = [...state.messages, message]
    historyContainer.appendChild(createMessageElement(message))
    scrollHistoryToBottom(historyContainer)
    persistState(storageKey, state, config.maxHistory)
    if (resetButton) {
      resetButton.disabled = state.messages.length === 0
    }
  }

  const replacePendingWith = (message: OracleMessage) => {
    state.messages = state.messages.map((entry) => (entry.pending ? message : entry))
    renderState(historyContainer, state)
    persistState(storageKey, state, config.maxHistory)
    if (resetButton) {
      resetButton.disabled = state.messages.length === 0
    }
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

    const userMessage: OracleMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      createdAt: now,
    }

    appendMessage(userMessage)
    textArea.value = ""
    autoResize()

    const pendingReply: OracleMessage = {
      id: generateId(),
      role: "assistant",
      content: "The ORA_CLE is thinking",
      createdAt: Date.now(),
      pending: true,
    }

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

      const assistantMessage: OracleMessage = {
        id: pendingReply.id,
        role: "assistant",
        content: replyText,
        createdAt: Date.now(),
      }

      replacePendingWith(assistantMessage)
      updateSendButtonState()
    } catch (error) {
      console.warn("ORA_CLE chat: request failed", error)
      state.messages = state.messages.filter((entry) => !entry.pending)
      renderState(historyContainer, state)
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
