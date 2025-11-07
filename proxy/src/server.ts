import "dotenv/config"

import cors, { type CorsOptions } from "cors"
import express, { NextFunction, Request, Response } from "express"
import helmet from "helmet"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { ReadableStream as NodeReadableStream } from "node:stream/web"
import { fileURLToPath } from "node:url"

import { config } from "./config.js"
import { oracleRequestSchema } from "./schema.js"
import { isRecaptchaEnabled, verifyRecaptcha } from "./recaptcha.js"
import { wikiSearchService } from "./wikiSearch.js"

const UPSTREAM_TIMEOUT_MS = Number.parseInt(process.env.UPSTREAM_TIMEOUT_MS ?? "", 10) || 65_000
const DEBUG_PROXY = (process.env.DEBUG_PROXY ?? "").trim().toLowerCase()
const DEBUG_PROXY_ENABLED = ["1", "true", "yes", "debug"].includes(DEBUG_PROXY)

const debugLog = (...args: unknown[]) => {
  if (DEBUG_PROXY_ENABLED) {
    console.log("🔍 [Proxy]", ...args)
  }
}

const createRequestId = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return crypto.randomBytes(12).toString("hex")
}

const getQueryParam = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (Array.isArray(value)) {
    const [first] = value
    if (typeof first === "string") {
      const trimmed = first.trim()
      return trimmed.length > 0 ? trimmed : undefined
    }
  }
  return undefined
}

const app = express()

if (config.trustProxy) {
  app.set("trust proxy", true)
}

const normaliseOrigin = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined
  }

  try {
    const url = new URL(value)
    return url.origin
  } catch (error) {
    return undefined
  }
}

const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) {
    return config.allowedOrigins.includes("*")
  }

  if (config.allowedOrigins.includes("*")) {
    return true
  }

  return config.allowedOrigins.some((allowed) => {
    try {
      const allowedOrigin = new URL(allowed).origin
      return allowedOrigin === origin
    } catch (error) {
      return allowed === origin
    }
  })
}

const getClientIp = (req: Request): string | undefined => {
  if (!config.trustProxy) {
    return req.ip
  }

  const forwarded = req.headers["x-forwarded-for"]
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim()
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(",")[0]?.trim()
  }
  return req.ip
}

app.use(
  (() => {
    const connectSrc = new Set<string>([
      "'self'",
      "https://www.google.com",
      "https://www.gstatic.com",
      "https://www.recaptcha.net",
      "https://www.googletagmanager.com",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ])
    const scriptSrc = new Set<string>([
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://www.google.com",
      "https://www.gstatic.com",
      "https://www.recaptcha.net",
      "https://utteranc.es",
      "https://www.googletagmanager.com",
    ])
    const styleSrc = new Set<string>([
      "'self'",
      "'unsafe-inline'",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
    ])
  const fontSrc = new Set<string>(["'self'", "data:"])
    const frameSrc = new Set<string>([
      "'self'",
      "https:",
      "https://discord.com",
      "https://utteranc.es",
      "https://giscus.app",
      "https://www.youtube.com",
      "https://www.google.com",
    ])
    const imgSrc = new Set<string>([
      "'self'",
      "data:",
      "https:",
      "https://cdn.discordapp.com",
      "https://media.discordapp.net",
      "https://images.unsplash.com",
      "https://i.imgur.com",
      "https://yt3.ggpht.com",
      "https://i.ytimg.com",
      "https://img.youtube.com",
      "https://www.google.com",
      "https://avatars.githubusercontent.com",
      "https://static-cdn.jtvnw.net",
      "https://www.recaptcha.net",
    ])
    const mediaSrc = new Set<string>(["'self'", "https:", "data:"])
    const manifestSrc = new Set<string>(["'self'"])
    const workerSrc = new Set<string>(["'self'", "blob:"])

    if (config.oracleApiBaseUrl) {
      try {
        const apiOrigin = new URL(config.oracleApiBaseUrl).origin
        connectSrc.add(apiOrigin)
      } catch (error) {
        console.warn("⚠️ [Proxy] Unable to parse ORACLE_API_BASE_URL for CSP", error)
      }
    }

    for (const origin of config.allowedOrigins) {
      if (origin === "*") {
        connectSrc.add("*")
        continue
      }
      try {
        const parsed = new URL(origin)
        connectSrc.add(parsed.origin)
      } catch (error) {
        connectSrc.add(origin)
      }
    }

    const cspDirectives = {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "object-src": ["'none'"],
      "font-src": Array.from(fontSrc),
      "style-src": Array.from(styleSrc),
      "script-src": Array.from(scriptSrc),
      "img-src": Array.from(imgSrc),
      "connect-src": Array.from(connectSrc),
      "frame-src": Array.from(frameSrc),
      "manifest-src": Array.from(manifestSrc),
      "media-src": Array.from(mediaSrc),
  "worker-src": Array.from(workerSrc),
  "child-src": ["'self'"],
    } as const

    const cspOptions = {
      useDefaults: false,
      directives: cspDirectives,
    } as const

    return helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: cspOptions,
    })
  })(),
)

const corsOptions: CorsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) {
      return callback(null, true)
    }

    if (isOriginAllowed(origin)) {
      return callback(null, true)
    }

    return callback(new Error("Not allowed by CORS"))
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "X-Requested-With",
    "X-Web-Api-Key",
    "X-Oracle-Key",
    "X-Oracle-Signature",
    "X-Oracle-Timestamp",
    "X-Oracle-Channel",
    "Authorization",
  ],
  maxAge: 300,
  credentials: true,
}

app.use(cors(corsOptions))

app.use(express.json({ limit: config.requestBodyLimit }))

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" })
})

app.get("/api/wiki-search", async (req: Request, res: Response) => {
  const requestId = createRequestId()
  const startedAt = Date.now()
  res.setHeader("X-Request-Id", requestId)

  if (config.searchApiKey) {
    const authHeader = req.get("x-oracle-search-key") ?? req.get("authorization")
    const extracted = authHeader?.replace(/^(Bearer|Token)\s+/i, "").trim()
    if (!extracted || extracted !== config.searchApiKey) {
      debugLog(`search ${requestId} blocked`, { reason: "auth" })
      return res.status(403).json({ success: false, reason: "Forbidden" })
    }
  }

  const query = getQueryParam(req.query.q)
  if (!query) {
    return res.status(400).json({ success: false, reason: "Missing query" })
  }

  if (query.trim().length < 2) {
    return res.status(400).json({ success: false, reason: "Query too short" })
  }

  const limitParam = getQueryParam(req.query.limit)
  const refreshParam = getQueryParam(req.query.refresh)
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined
  const effectiveLimit = limit && Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : undefined

  try {
    if (refreshParam && ["1", "true", "refresh"].includes(refreshParam.toLowerCase())) {
      await wikiSearchService.reload()
    }

    const results = await wikiSearchService.search(query, effectiveLimit)
    const tookMs = Date.now() - startedAt
    debugLog(`search ${requestId} ok`, { query, count: results.length, tookMs })
    return res.json({
      success: true,
      query,
      results,
      count: results.length,
      tookMs,
      lastLoadedAt: wikiSearchService.getLastLoadedAt(),
    })
  } catch (error) {
    console.error("⚠️ [Proxy] Wiki search failed", { requestId, query, error })
    return res.status(500).json({ success: false, reason: "Search failed" })
  }
})

app.post("/api/oracle/query", async (req: Request, res: Response) => {
  const requestId = createRequestId()
  const startedAt = Date.now()
  res.setHeader("X-Request-Id", requestId)
  res.once("finish", () => {
    const durationMs = Date.now() - startedAt
    debugLog(`req ${requestId} completed`, { status: res.statusCode, durationMs })
  })

  const origin = normaliseOrigin(req.get("origin") ?? req.get("referer"))

  if (!isOriginAllowed(origin)) {
    debugLog(`req ${requestId} blocked`, { reason: "origin", origin })
    return res.status(403).json({ success: false, reason: "Origin not allowed" })
  }

  const parseResult = oracleRequestSchema.safeParse(req.body)
  if (!parseResult.success) {
    debugLog(`req ${requestId} invalid`, { reason: "payload", issues: parseResult.error.issues.slice(0, 3) })
    return res.status(400).json({ success: false, reason: "Invalid request payload", issues: parseResult.error.issues })
  }

  const data = parseResult.data

  if (DEBUG_PROXY_ENABLED) {
    const messageRoles = Array.isArray(data.messages) ? data.messages.map((message) => message.role) : []
    const metadataKeys = data.metadata ? Object.keys(data.metadata) : []
    debugLog(`req ${requestId} payload`, {
      conversationId: data.conversationId ?? null,
      priority: data.priority ?? null,
      messageRoles,
      metadataKeys,
      hasCaptcha: Boolean(data.captchaToken),
      origin,
    })
  }

  if (isRecaptchaEnabled()) {
    if (!data.captchaToken) {
      debugLog(`req ${requestId} blocked`, { reason: "missing_captcha" })
      return res.status(400).json({ success: false, reason: "captchaToken is required" })
    }

    const captchaOk = await verifyRecaptcha(data.captchaToken, getClientIp(req))
    if (!captchaOk) {
      debugLog(`req ${requestId} blocked`, { reason: "captcha_failed" })
      return res.status(400).json({ success: false, reason: "Captcha verification failed" })
    }
  }

  const upstreamUrl = `${config.oracleApiBaseUrl}${config.oracleApiEndpoint}`

  const metadata = {
    ...data.metadata,
    proxyOrigin: origin ?? null,
    clientIp: getClientIp(req) ?? null,
    userAgent: req.get("user-agent") ?? null,
  }

  const upstreamPayload = {
    ...data,
    metadata,
    channel: data.channel ?? "web-proxy",
  }

  const serializedBody = JSON.stringify(upstreamPayload)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signaturePayload = `${timestamp}.${serializedBody}`
  const signature = crypto.createHmac("sha256", config.oracleSigningSecret).update(signaturePayload).digest("hex")

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Web-Api-Key": config.oracleWebApiToken,
        "X-Oracle-Key": config.oracleKeyId,
        "X-Oracle-Timestamp": timestamp,
        "X-Oracle-Signature": signature,
        "X-Oracle-Channel": "web-proxy",
        "X-Oracle-Request-Id": requestId,
      },
      body: serializedBody,
      signal: controller.signal,
    })

    const responseText = await upstreamResponse.text()
    if (DEBUG_PROXY_ENABLED) {
      debugLog(`req ${requestId} upstream`, {
        status: upstreamResponse.status,
        requestDurationMs: Date.now() - startedAt,
        headers: {
          cached: upstreamResponse.headers.get("x-oracle-cached") ?? null,
          contextHash: upstreamResponse.headers.get("x-oracle-context-hash") ?? null,
        },
      })
    }
    if (!upstreamResponse.ok) {
      console.error("⚠️ [Proxy] Upstream error", {
        requestId,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        bodyPreview: responseText.length > 500 ? `${responseText.slice(0, 500)}…` : responseText,
      })
    }
    const responseHeaders: Record<string, string> = {}
    upstreamResponse.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith("x-oracle-")) {
        responseHeaders[key] = value
      }
    })

    if (responseText.length > 0) {
      try {
        const json = JSON.parse(responseText)
        return res
          .status(upstreamResponse.status)
          .set(responseHeaders)
          .json(json)
      } catch (error) {
        return res
          .status(upstreamResponse.status)
          .set(responseHeaders)
          .type(upstreamResponse.headers.get("content-type") ?? "text/plain")
          .send(responseText)
      }
    }

    return res.status(upstreamResponse.status).set(responseHeaders).send()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("⚠️ [Proxy] Upstream request timed out", {
        requestId,
        timeoutMs: UPSTREAM_TIMEOUT_MS,
        endpoint: upstreamUrl,
      })
      return res.status(504).json({ success: false, reason: "Upstream request timed out" })
    }
    console.error("Oracle proxy request failed", { requestId, error })
    return res.status(502).json({ success: false, reason: "Upstream request failed" })
  } finally {
    clearTimeout(timeoutHandle)
  }
})

app.get("/api/oracle/context-stream", async (req: Request, res: Response) => {
  const requestId = createRequestId()
  const messageId = getQueryParam(req.query.messageId)
  const conversationId = getQueryParam(req.query.conversationId)

  if (!messageId) {
    return res.status(400).json({ success: false, reason: "messageId query parameter is required" })
  }

  const upstreamUrl = new URL(config.oracleContextStreamEndpoint, config.oracleApiBaseUrl)
  upstreamUrl.searchParams.set("messageId", messageId)
  if (conversationId) {
    upstreamUrl.searchParams.set("conversationId", conversationId)
  }

  debugLog(`stream ${requestId} start`, { upstream: upstreamUrl.toString() })

  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.setHeader("X-Request-Id", requestId)
  res.flushHeaders()

  req.socket.setTimeout(0)
  req.socket.setNoDelay(true)
  req.socket.setKeepAlive(true)

  const controller = new AbortController()
  const onClientClose = () => {
    debugLog(`stream ${requestId} client closed`)
    controller.abort()
  }
  req.on("close", onClientClose)
  res.on("close", () => {
    if (typeof req.off === "function") {
      req.off("close", onClientClose)
    } else {
      req.removeListener("close", onClientClose)
    }
  })

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-Web-Api-Key": config.oracleWebApiToken,
      },
      signal: controller.signal,
    })

    if (!upstreamResponse.ok) {
      const bodyText = await upstreamResponse.text()
      debugLog(`stream ${requestId} upstream error`, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        bodyPreview: bodyText.slice(0, 200),
      })
      res.write(`event: error\ndata: ${JSON.stringify({ message: "Upstream stream failed." })}\n\n`)
      return res.end()
    }

    if (!upstreamResponse.body) {
      res.write(`event: complete\ndata: ${JSON.stringify({ final: true })}\n\n`)
      return res.end()
    }

  const reader = Readable.fromWeb(upstreamResponse.body as unknown as NodeReadableStream<Uint8Array>)
    reader.on("error", (error) => {
      debugLog(`stream ${requestId} reader error`, { error })
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "Stream interrupted." })}\n\n`)
        res.end()
      }
    })
    reader.on("end", () => {
      debugLog(`stream ${requestId} upstream closed`)
      if (!res.writableEnded) {
        res.end()
      }
    })

    reader.pipe(res, { end: false })
  } catch (error) {
    if (controller.signal.aborted) {
      return res.end()
    }
    console.error("⚠️ [Proxy] Context stream failed", { requestId, error })
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: "Context stream failed." })}\n\n`)
      res.end()
    }
  }
})

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultStaticRoot = path.resolve(currentDir, "..", "..", "quartz-site", "public")
const envStaticRoot = process.env.STATIC_ROOT?.trim()
const staticRoot = envStaticRoot && envStaticRoot.length > 0 ? path.resolve(envStaticRoot) : defaultStaticRoot
const allowMissingStatic = ["1", "true", "yes"].includes((process.env.ALLOW_MISSING_STATIC ?? "").trim().toLowerCase())

const requiredStaticEntries: string[] = [
  "index.html",
  "index.css",
  "postscript.js",
  path.join("static", "fonts"),
  path.join("static", "katex", "katex.min.css"),
  path.join("static", "katex", "contrib", "copy-tex.min.js"),
]

const missingStaticEntries = (): string[] => {
  const missing: string[] = []
  for (const entry of requiredStaticEntries) {
    const target = path.join(staticRoot, entry)
    try {
      fs.accessSync(target, fs.constants.R_OK)
    } catch (error) {
      missing.push(entry)
    }
  }
  return missing
}

let hasStaticAssets = false

if (!fs.existsSync(staticRoot)) {
  const message = `⚠️ [Proxy] Static root not found at ${staticRoot}`
  if (allowMissingStatic) {
    console.warn(message)
  } else {
    console.error(`${message}. Set ALLOW_MISSING_STATIC=1 to bypass this check temporarily.`)
    process.exit(1)
  }
} else {
  const missing = missingStaticEntries()
  if (missing.length > 0) {
    const message = `⚠️ [Proxy] Missing required static assets: ${missing.join(", ")}`
    if (allowMissingStatic) {
      console.warn(message)
    } else {
      console.error(`${message}. Ensure the Quartz build has completed before starting the proxy.`)
      process.exit(1)
    }
  }

  hasStaticAssets = true
  console.log(`ℹ️ [Proxy] Serving static assets from ${staticRoot}`)
  app.use(
    express.static(staticRoot, {
      extensions: ["html"],
      maxAge: "1h",
      index: ["index.html"],
    }),
  )
}

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) {
    return next()
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next()
  }
  if (!hasStaticAssets) {
    return res.status(404).send("Not Found")
  }

  const normalizePath = (value: string): string => {
    let decoded: string
    try {
      decoded = decodeURIComponent(value)
    } catch (error) {
      debugLog("failed to decode path", { value, error })
      decoded = value
    }
    const normalized = path.posix.normalize(decoded).replace(/^\/+/, "")
    const segments = normalized.split("/").filter((segment) => segment.length > 0)
    const safeSegments: string[] = []
    for (const segment of segments) {
      if (segment === ".") {
        continue
      }
      if (segment === "..") {
        safeSegments.pop()
        continue
      }
      safeSegments.push(segment)
    }

    if (safeSegments.length === 0) {
      return "index.html"
    }
    return safeSegments.join("/")
  }

  const trySendFile = (
    candidate: string,
    onFail: () => void,
    onError: (error: NodeJS.ErrnoException) => void,
  ) => {
    res.sendFile(candidate, { root: staticRoot }, (err) => {
      if (!err) {
        return
      }

      if ("code" in err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === "EISDIR") {
          const indexPath = path.posix.join(candidate, "index.html")
          return trySendFile(indexPath, onFail, onError)
        }
        if (code === "ENOENT") {
          return onFail()
        }
      }

      onError(err as NodeJS.ErrnoException)
    })
  }

  const fallbackToIndex = () => {
    const sendIndex = () =>
      res.sendFile(path.join(staticRoot, "index.html"), (err) => {
        if (err) {
          next(err)
        }
      })

    if (fs.existsSync(path.join(staticRoot, "404.html"))) {
      return res.status(404).sendFile("404.html", { root: staticRoot }, (err) => {
        if (err) {
          return sendIndex()
        }
      })
    }

    return sendIndex()
  }

  const safePath = normalizePath(req.path)

  trySendFile(
    safePath,
    fallbackToIndex,
    (error) => {
      debugLog("static file error", {
        path: req.path,
        safePath,
        code: error.code ?? null,
        message: error.message,
      })
      next(error)
    },
  )
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, reason: "Origin not allowed" })
  }

  console.error("Unhandled error", err)
  return res.status(500).json({ success: false, reason: "Internal server error" })
})

export const start = () => {
  app.listen(config.port, () => {
    console.log(`Oracle proxy listening on port ${config.port}`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start()
}
