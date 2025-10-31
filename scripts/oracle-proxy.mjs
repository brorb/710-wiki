#!/usr/bin/env node
import { createServer } from "node:http"
import { URL } from "node:url"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import * as dotenv from "dotenv"

// Resolve workspace root so the proxy can reuse the same env loading order as Quartz.
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(moduleDir, "..")
const candidateEnvFiles = [
  path.join(workspaceRoot, ".env"),
  path.join(workspaceRoot, "quartz-site", ".env"),
]
for (const candidate of candidateEnvFiles) {
  dotenv.config({ path: candidate, override: false })
}

const DEFAULT_TARGET = "https://discord-system-firebase-bot-production.up.railway.app"
const proxyPort = Number.parseInt(process.env.ORACLE_PROXY_PORT ?? "8787", 10)
const targetBase = process.env.ORACLE_PROXY_TARGET?.trim() || DEFAULT_TARGET
const downstreamEndpoint = process.env.ORACLE_PROXY_ENDPOINT?.trim() || "/api/oracle/query"

const allowedHeaders = [
  "Content-Type",
  "X-Web-Api-Key",
  "X-Oracle-Key",
  "X-Oracle-Timestamp",
  "X-Oracle-Signature",
]
const allowHeadersHeader = [...allowedHeaders, "Accept", "Origin"].join(", ")

const log = (...args) => {
  const timestamp = new Date().toISOString()
  console.info(`[oracle-proxy ${timestamp}]`, ...args)
}

const applyCors = (response, origin) => {
  const effectiveOrigin = origin || "*"
  response.setHeader("Access-Control-Allow-Origin", effectiveOrigin)
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.setHeader("Access-Control-Allow-Headers", allowHeadersHeader)
  response.setHeader("Access-Control-Max-Age", "600")
  if (effectiveOrigin !== "*") {
    response.setHeader("Vary", "Origin")
  }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin
  applyCors(response, origin)

  if (request.method === "OPTIONS") {
    response.writeHead(204).end()
    return
  }

  if (!request.url) {
    response.writeHead(400, { "Content-Type": "application/json" }).end(
      JSON.stringify({ error: "Missing request URL" }),
    )
    return
  }

  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({ status: "ok", target: targetBase, endpoint: downstreamEndpoint }),
    )
    return
  }

  if (request.method !== "POST" || !request.url.startsWith(downstreamEndpoint)) {
    response.writeHead(404, { "Content-Type": "application/json" }).end(
      JSON.stringify({ error: "Unsupported route" }),
    )
    return
  }

  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  const bodyBuffer = Buffer.concat(chunks)

  const upstreamUrl = new URL(downstreamEndpoint, targetBase)

  const headerOverrides = {
    "Content-Type": request.headers["content-type"] || "application/json",
  }

  const copyHeader = (name) => {
    const rawValue = request.headers[name.toLowerCase()]
    if (Array.isArray(rawValue)) {
      return rawValue.join(", ")
    }
    return rawValue
  }

  const outboundHeaders = {
    ...headerOverrides,
  }

  const webApiKey = copyHeader("X-Web-Api-Key") || process.env.ORACLE_WEB_API_TOKEN
  const oracleKeyId = copyHeader("X-Oracle-Key") || process.env.ORACLE_KEY_ID || process.env.ORACLE_SIGNING_KEY_ID
  const oracleTimestamp = copyHeader("X-Oracle-Timestamp")
  const oracleSignature = copyHeader("X-Oracle-Signature")

  if (webApiKey) {
    outboundHeaders["X-Web-Api-Key"] = webApiKey
  }
  if (oracleKeyId) {
    outboundHeaders["X-Oracle-Key"] = oracleKeyId
  }
  if (oracleTimestamp) {
    outboundHeaders["X-Oracle-Timestamp"] = oracleTimestamp
  }
  if (oracleSignature) {
    outboundHeaders["X-Oracle-Signature"] = oracleSignature
  }

  log("Forwarding request", {
    origin: origin || null,
    target: upstreamUrl.toString(),
    bodyBytes: bodyBuffer.byteLength,
    hasWebApiKey: Boolean(outboundHeaders["X-Web-Api-Key"]),
    hasOracleKey: Boolean(outboundHeaders["X-Oracle-Key"]),
  })

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: outboundHeaders,
      body: bodyBuffer,
    })

    const upstreamBody = Buffer.from(await upstreamResponse.arrayBuffer())
    const responseHeaders = {
      "Content-Type": upstreamResponse.headers.get("content-type") || "application/json",
    }

    response.writeHead(upstreamResponse.status, responseHeaders)
    response.end(upstreamBody)
    log("Upstream response", {
      status: upstreamResponse.status,
      ok: upstreamResponse.ok,
      bytes: upstreamBody.byteLength,
    })
  } catch (error) {
    log("Proxy error", { error: error instanceof Error ? error.message : String(error) })
    response.writeHead(502, { "Content-Type": "application/json" }).end(
      JSON.stringify({ error: "Oracle proxy failed", detail: error instanceof Error ? error.message : String(error) }),
    )
  }
})

server.listen(proxyPort, () => {
  log("Oracle proxy listening", { port: proxyPort, targetBase, endpoint: downstreamEndpoint })
})
