import "dotenv/config"

import cors, { type CorsOptions } from "cors"
import express, { NextFunction, Request, Response } from "express"
import helmet from "helmet"
import crypto from "node:crypto"

import { config } from "./config.js"
import { oracleRequestSchema } from "./schema.js"
import { isRecaptchaEnabled, verifyRecaptcha } from "./recaptcha.js"

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
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }),
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
  allowedHeaders: ["Content-Type", "X-Requested-With"],
  maxAge: 300,
  credentials: true,
}

app.use(cors(corsOptions))

app.use(express.json({ limit: config.requestBodyLimit }))

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" })
})

app.post("/api/oracle/query", async (req: Request, res: Response) => {
  const origin = normaliseOrigin(req.get("origin") ?? req.get("referer"))

  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ success: false, reason: "Origin not allowed" })
  }

  const parseResult = oracleRequestSchema.safeParse(req.body)
  if (!parseResult.success) {
    return res.status(400).json({ success: false, reason: "Invalid request payload", issues: parseResult.error.issues })
  }

  const data = parseResult.data

  if (isRecaptchaEnabled()) {
    if (!data.captchaToken) {
      return res.status(400).json({ success: false, reason: "captchaToken is required" })
    }

    const captchaOk = await verifyRecaptcha(data.captchaToken, getClientIp(req))
    if (!captchaOk) {
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
      },
      body: serializedBody,
    })

    const responseText = await upstreamResponse.text()
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
    console.error("Oracle proxy request failed", error)
    return res.status(502).json({ success: false, reason: "Upstream request failed" })
  }
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
