import { z } from "zod"

const envSchema = z.object({
  PORT: z.string().optional(),
  ORACLE_API_BASE_URL: z.string().url("ORACLE_API_BASE_URL must be a valid URL"),
  ORACLE_API_ENDPOINT: z.string().default("/api/oracle/query"),
  ORACLE_WEB_API_TOKEN: z.string().min(1, "ORACLE_WEB_API_TOKEN is required"),
  ORACLE_KEY_ID: z.string().min(1, "ORACLE_KEY_ID is required"),
  ORACLE_SIGNING_SECRET: z.string().min(1, "ORACLE_SIGNING_SECRET is required"),
  ALLOWED_ORIGINS: z.string().default("*"),
  TRUST_PROXY: z.string().optional(),
  REQUEST_BODY_LIMIT: z.string().optional(),
  RECAPTCHA_SECRET: z.string().optional(),
})

const raw = envSchema.parse(process.env)

const normaliseEndpoint = (endpoint: string) => {
  if (!endpoint.startsWith("/")) {
    return `/${endpoint}`
  }
  return endpoint
}

const parseAllowedOrigins = (input: string): string[] => {
  if (!input || input.trim() === "") {
    return []
  }

  if (input.trim() === "*") {
    return ["*"]
  }

  return input
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export const config = {
  port: Number.parseInt(raw.PORT ?? "", 10) || 8080,
  oracleApiBaseUrl: raw.ORACLE_API_BASE_URL.replace(/\/$/, ""),
  oracleApiEndpoint: normaliseEndpoint(raw.ORACLE_API_ENDPOINT),
  oracleWebApiToken: raw.ORACLE_WEB_API_TOKEN,
  oracleKeyId: raw.ORACLE_KEY_ID,
  oracleSigningSecret: raw.ORACLE_SIGNING_SECRET,
  allowedOrigins: parseAllowedOrigins(raw.ALLOWED_ORIGINS),
  trustProxy: raw.TRUST_PROXY === "true" || raw.TRUST_PROXY === "1",
  requestBodyLimit: raw.REQUEST_BODY_LIMIT?.trim() || "32kb",
  recaptchaSecret: raw.RECAPTCHA_SECRET?.trim() || undefined,
} as const

export type AppConfig = typeof config
