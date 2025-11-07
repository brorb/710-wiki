import { z } from "zod"

const envSchema = z.object({
  PORT: z.string().optional(),
  ORACLE_API_BASE_URL: z.string().url("ORACLE_API_BASE_URL must be a valid URL"),
  ORACLE_API_ENDPOINT: z.string().default("/api/oracle/query"),
  ORACLE_CONTEXT_STREAM_ENDPOINT: z.string().default("/api/oracle/context-stream"),
  ORACLE_WEB_API_TOKEN: z.string().min(1, "ORACLE_WEB_API_TOKEN is required"),
  ORACLE_KEY_ID: z.string().min(1, "ORACLE_KEY_ID is required"),
  ORACLE_SIGNING_SECRET: z.string().min(1, "ORACLE_SIGNING_SECRET is required"),
  ALLOWED_ORIGINS: z.string().default("*"),
  TRUST_PROXY: z.string().optional(),
  REQUEST_BODY_LIMIT: z.string().optional(),
  RECAPTCHA_SECRET: z.string().optional(),
  WIKI_SEARCH_INDEX_PATH: z.string().optional(),
  WIKI_SEARCH_INDEX_URL: z.string().url("WIKI_SEARCH_INDEX_URL must be a valid URL").optional(),
  WIKI_SEARCH_RESULT_LIMIT: z.string().optional(),
  WIKI_SEARCH_BASE_URL: z.string().url("WIKI_SEARCH_BASE_URL must be a valid URL").optional(),
  WIKI_SEARCH_API_KEY: z.string().optional(),
  LITERAL_SEARCH_ENABLED: z.string().optional(),
  LITERAL_SEARCH_MAX_RESULTS: z.string().optional(),
  LITERAL_SEARCH_MIN_SCORE: z.string().optional(),
  LITERAL_SEARCH_SCORE_BASE: z.string().optional(),
  LITERAL_SEARCH_SCORE_BONUS: z.string().optional(),
  LITERAL_SEARCH_TITLE_MATCH_BOOST: z.string().optional(),
  LITERAL_SEARCH_SNIPPET_CHARS: z.string().optional(),
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
  oracleContextStreamEndpoint: normaliseEndpoint(raw.ORACLE_CONTEXT_STREAM_ENDPOINT),
  oracleWebApiToken: raw.ORACLE_WEB_API_TOKEN,
  oracleKeyId: raw.ORACLE_KEY_ID,
  oracleSigningSecret: raw.ORACLE_SIGNING_SECRET,
  allowedOrigins: parseAllowedOrigins(raw.ALLOWED_ORIGINS),
  trustProxy: raw.TRUST_PROXY === "true" || raw.TRUST_PROXY === "1",
  requestBodyLimit: raw.REQUEST_BODY_LIMIT?.trim() || "32kb",
  recaptchaSecret: raw.RECAPTCHA_SECRET?.trim() || undefined,
  searchIndexPath: raw.WIKI_SEARCH_INDEX_PATH?.trim() || undefined,
  searchIndexUrl: raw.WIKI_SEARCH_INDEX_URL?.trim() || undefined,
  searchResultLimit: (() => {
    const candidate = raw.WIKI_SEARCH_RESULT_LIMIT?.trim()
    if (!candidate) {
      return undefined
    }
    const parsed = Number.parseInt(candidate, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  })(),
  searchBaseUrl: raw.WIKI_SEARCH_BASE_URL?.trim() || undefined,
  searchApiKey: raw.WIKI_SEARCH_API_KEY?.trim() || undefined,
  literalSearchEnabled: (() => {
    const candidate = raw.LITERAL_SEARCH_ENABLED?.trim().toLowerCase()
    if (!candidate) {
      return true
    }
    return ["1", "true", "yes", "on", "enabled"].includes(candidate)
  })(),
  literalSearchMaxResults: (() => {
    const candidate = raw.LITERAL_SEARCH_MAX_RESULTS?.trim()
    if (!candidate) {
      return 2
    }
    const parsed = Number.parseInt(candidate, 10)
    if (!Number.isFinite(parsed)) {
      return 2
    }
    return Math.max(1, Math.min(parsed, 8))
  })(),
  literalSearchMinScore: (() => {
    const candidate = raw.LITERAL_SEARCH_MIN_SCORE?.trim()
    if (!candidate) {
      return 0.55
    }
    const parsed = Number.parseFloat(candidate)
    if (!Number.isFinite(parsed)) {
      return 0.55
    }
    if (parsed < 0) {
      return 0
    }
    if (parsed > 1) {
      return 1
    }
    return parsed
  })(),
  literalSearchScoreBase: (() => {
    const candidate = raw.LITERAL_SEARCH_SCORE_BASE?.trim()
    if (!candidate) {
      return 0.78
    }
    const parsed = Number.parseFloat(candidate)
    return Number.isFinite(parsed) ? parsed : 0.78
  })(),
  literalSearchScoreBonus: (() => {
    const candidate = raw.LITERAL_SEARCH_SCORE_BONUS?.trim()
    if (!candidate) {
      return 0.04
    }
    const parsed = Number.parseFloat(candidate)
    if (!Number.isFinite(parsed)) {
      return 0.04
    }
    return Math.max(0, parsed)
  })(),
  literalSearchTitleMatchBoost: (() => {
    const candidate = raw.LITERAL_SEARCH_TITLE_MATCH_BOOST?.trim()
    if (!candidate) {
      return 0.35
    }
    const parsed = Number.parseFloat(candidate)
    if (!Number.isFinite(parsed)) {
      return 0.35
    }
    return Math.max(0, parsed)
  })(),
  literalSearchSnippetChars: (() => {
    const candidate = raw.LITERAL_SEARCH_SNIPPET_CHARS?.trim()
    if (!candidate) {
      return 600
    }
    const parsed = Number.parseInt(candidate, 10)
    if (!Number.isFinite(parsed)) {
      return 600
    }
    return Math.max(120, parsed)
  })(),
} as const

export type AppConfig = typeof config
