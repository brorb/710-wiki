# Oracle Web Proxy

A lightweight Express proxy that keeps the Oracle API credentials on the server side and forwards chat requests from the public web UI to the protected Oracle backend.

## Features

- Hides `ORACLE_WEB_API_TOKEN`, `ORACLE_KEY_ID`, and `ORACLE_SIGNING_SECRET` from the browser.
- Verifies request shape and enforces sane size limits before forwarding.
- Optionally validates reCAPTCHA tokens to slow down scripted abuse.
- Restricts access to approved origins via CORS and per-request checks.
- Adds request context metadata (origin, IP, user agent) before relaying to the Oracle API.

## Request Lifecycle Overview

```mermaid
flowchart TD
   A[Browser request] --> B{Origin allowed?}
   B -- No --> X[403 Forbidden]
   B -- Yes --> C[Size & schema validation]
   C -- Fail --> Y[400 Bad Request]
   C -- Pass --> D{reCAPTCHA enabled?}
   D -- Yes --> E[Verify token]
   D -- No --> F[Assemble Oracle headers]
   E -- Fail --> Z[403 reCAPTCHA failed]
   E -- Pass --> F
   F --> G[Sign payload (timestamp.body)]
   G --> H[Forward to Oracle API]
   H --> I{Response OK?}
   I -- No --> J[Bubble upstream error]
   I -- Yes --> K[Return JSON to client]

```

| Stage | Implementation | Notes |
| --- | --- | --- |
| Origin gate | `isOriginAllowed` helper in `server.ts` | Compares parsed origin against `ALLOWED_ORIGINS`; rejects mismatches with `403`. |
| Payload validation | `oracleRequestSchema.safeParse` | Enforces JSON limit (`REQUEST_BODY_LIMIT`) and required fields before forwarding. |
| reCAPTCHA | `verifyRecaptcha` helper | Skips when `RECAPTCHA_SECRET` is empty; logs latency + score when present. |
| Signing | Inline `crypto.createHmac` call | Produces `X-Oracle-Timestamp`, `X-Oracle-Key`, and `X-Oracle-Signature`. |
| Forwarding | Native `fetch` with `AbortController` | Targets `ORACLE_API_BASE_URL` + `ORACLE_API_ENDPOINT`; enforces `UPSTREAM_TIMEOUT_MS`. |
| Response shaping | Route handler response mapping | Copies upstream `X-Oracle-*` headers and echoes status/body for the browser. |

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create your environment file**

   ```bash
   cp .env.example .env
   ```

   Populate every placeholder with the secrets from Railway (never check the filled `.env` into git).

3. **Run locally**

   ```bash
   npm run dev
   ```

   The proxy listens on `http://localhost:8080` by default.

4. **Build for production**

   ```bash
   npm run build
   npm start
   ```

## Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Port to bind to (defaults to `8080`). |
| `ORACLE_API_BASE_URL` | Base URL of the Oracle backend (e.g. Railway Anthropic service). |
| `ORACLE_API_ENDPOINT` | Relative path of the Oracle endpoint (defaults to `/api/oracle/query`). |
| `ORACLE_WEB_API_TOKEN` | The shared API token supplied to the Oracle backend in `X-Web-Api-Key`. |
| `ORACLE_KEY_ID` | Identifier used for the HMAC signing header (`X-Oracle-Key`). |
| `ORACLE_SIGNING_SECRET` | The HMAC secret used to sign payloads (`X-Oracle-Signature`). |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the proxy (e.g. `https://7-10.wiki,http://localhost:8080`). Use `*` only for trusted internal testing. |
| `TRUST_PROXY` | Set to `true` when running behind Railway/another proxy so the client IP can be derived correctly. |
| `REQUEST_BODY_LIMIT` | Optional Express JSON body limit (default `32kb`). |
| `RECAPTCHA_SECRET` | Optional secret for verifying reCAPTCHA tokens. Leave empty to disable verification. |

## Deployment on Railway

1. Create a new Railway service from this folder (Dockerfile is not required; Railway can run `npm run build && npm start`).
2. Add all environment variables in the Railway dashboard. **Do not expose these secrets to the frontend.**
3. Configure the public domain that Railway assigns as the `ORACLE_PROXY_BASE_URL`. Use HTTPS.
4. Update the Quartz site configuration to point the chat widget at the new proxy domain (see repo root instructions).

## Security Notes

- Rotate every Oracle credential after deploying the proxy—those values were previously embedded in the static site and should be considered compromised.
- Keep the `ALLOWED_ORIGINS` list tight. Requests with missing or mismatched origins are rejected.
- Enable `RECAPTCHA_SECRET` to enforce token verification if you already collect reCAPTCHA tokens in the UI.
- Consider adding a lightweight rate limiter (Redis, Upstash) if abuse becomes a problem.
