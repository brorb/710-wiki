import "dotenv/config"

import cors, { type CorsOptions } from "cors"
import express, { NextFunction, Request, Response } from "express"
import helmet from "helmet"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "./config.js"
import { oracleRequestSchema } from "./schema.js"
import { isRecaptchaEnabled, verifyRecaptcha } from "./recaptcha.js"

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
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
    ])
  const fontSrc = new Set<string>(["'self'", "data:", "https://fonts.gstatic.com", "https://fonts.googleapis.com"])
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
  methods: ["POST", "OPTIONS"],
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

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultStaticRoot = path.resolve(currentDir, "..", "..", "quartz-site", "public")
const staticRoot = (process.env.STATIC_ROOT && process.env.STATIC_ROOT.trim()) || defaultStaticRoot
const hasStaticAssets = fs.existsSync(staticRoot)

if (!hasStaticAssets) {
  console.warn(`⚠️ [Proxy] Static root not found at ${staticRoot}`)
} else {
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

  const resolved = path.resolve(staticRoot, `.${req.path}`)
  if (!resolved.startsWith(staticRoot)) {
    return res.status(403).send("Forbidden")
  }

  try {
    const stats = fs.statSync(resolved)
    if (stats.isFile()) {
      return res.sendFile(resolved)
    }
    if (stats.isDirectory()) {
      const indexFile = path.join(resolved, "index.html")
      if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile)
      }
    }
  } catch (error) {
    // fall through to send fallback index
  }

  const notFoundFile = path.join(staticRoot, "404.html")
  if (fs.existsSync(notFoundFile)) {
    return res.status(404).sendFile(notFoundFile)
  }

  const fallbackFile = path.join(staticRoot, "index.html")
  if (fs.existsSync(fallbackFile)) {
    return res.sendFile(fallbackFile)
  }

  return res.status(404).send("Not Found")
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
