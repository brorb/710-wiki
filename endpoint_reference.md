````markdown
# ORA_CLE Web API Endpoint Reference

Use this guide to validate your front-end integration against the production ORA_CLE endpoint.

## Endpoint Summary
- **URL**: `https://discord-system-firebase-bot-production.up.railway.app/api/oracle/query`
- **Method**: `POST`
- **Timeout**: 10 seconds (server enforced)

## Required Headers
| Header | Value | Notes |
|--------|-------|-------|
| `Content-Type` | `application/json` | Body must be JSON. |
| `X-Web-Api-Key` | `<ORACLE_WEB_API_TOKEN>` | Must match the Railway secret. |
| `X-Oracle-Key` | `<key-id>` | e.g. `wiki-widget`; determine signing secret via config. |
| `X-Oracle-Timestamp` | `<unix-seconds>` | ±300 second tolerance. |
| `X-Oracle-Signature` | `hex(hmac_sha256(secret, "timestamp.body"))` | Sign the exact body bytes using the secret tied to `X-Oracle-Key`. |
| `X-Oracle-Channel` | `web` | Indicates the web persona; enables channel-specific prompts and sanitizers. |

## Request Payload
```json
{
  "conversationId": "optional-id-or-null",
  "question": "explicit user question",
  "messages": [
    {"role": "user", "content": "Prior question"},
    {"role": "assistant", "content": "Prior answer"},
    {"role": "user", "content": "Current question"}
  ],
  "metadata": {
    "origin": "710tone.wiki",
    "path": "/Discord/System-Chats",
    "url": "https://www.710tone.wiki/Discord/System-Chats",
    "timestamp": "2025-10-30T18:22:11Z",
    "channel": "web"
  },
  "priority": "medium",
  "sections": 18,
  "creativeMode": false,
  "captchaToken": "optional-recaptcha-token",
  "channel": "web"
}
```

### Field Notes
- `question` may be omitted only if the last message in `messages` is a `user` turn; otherwise it is required.
- `messages` allows optional chat history; malformed entries are ignored. Pending assistant placeholders should be stripped before dispatch to avoid sending "thinking" bubbles.
- `metadata`, `priority`, `sections`, `creativeMode`, `captchaToken`, and `channel` are optional. Extra fields are ignored but stored in logs. Supplying `channel: "web"` (both at the top level and inside `metadata.channel`) activates the web persona prompt on the backend.

## Successful Response
```json
{
  "conversationId": "3f9d2c74-1b61-4e6e-94e0-31e917e18bb5",
  "reply": "Markdown-safe fallback reply",
  "webPayload": {
    "lead": "High-level summary for the web persona",
    "answer": "Optional supporting paragraph",
    "contextSnippets": [
      {
        "title": "SYSTEM",
        "summary": "One-line synopsis of the indexed chunk",
        "url": "https://www.710tone.wiki/Characters/SYSTEM",
        "section": "Transmission Log",
        "strength": "Canonical"
      }
    ],
    "sources": [
      {
        "title": "Signal 849 Recording",
        "description": "Primary audio evidence",
        "url": "https://www.710tone.wiki/Media/710-Media/Audio/SIGNAL849-(1).mp3",
        "strength": "Primary"
      }
    ],
    "followUpQuestions": [
      "What other CIN Center signals mention SYSTEM?"
    ],
    "callToAction": "Review the CIN Centers concept note for the full roster.",
    "disclaimers": ["Citations reference the latest nightly Quartz build (UTC)."]
  },
  "messages": [
    {"role": "assistant", "content": "Markdown reply"},
    {"role": "system", "content": "Guard flags: curated_miss"}
  ],
  "disclaimers": [
    "Audio clips may require a second to buffer from cold cache."
  ],
  "success": true,
  "priority": "medium",
  "triage": {"priority": "medium", "reason": "classifier"},
  "cached": false,
  "model": "claude-3-haiku-20240307",
  "usage": {"input": 1800, "output": 320, "total": 2120},
  "sources": ["Funded Death Institute"],
  "contextHash": "abc123...",
  "contextMeta": {"chunks": 18, "tokens": 7600, "stop": "soft_max"},
  "guardFlags": [],
  "linkNotes": [],
  "metadata": {"origin": "710tone.wiki"}
}
```

- `success` becomes `false` when ORA_CLE cannot answer confidently. Failures include a `reason` (e.g., `"no_context"`) and still return a fallback `reply`.
- `webPayload` carries the structured content that powers the web widget. Populate `lead`, `contextSnippets`, `sources`, follow-up suggestions, CTAs, and channel-specific disclaimers as needed. The client falls back to `reply` when `webPayload` is omitted.
- `disclaimers` (top-level) display beneath the rendered answer and merge with `webPayload.disclaimers`.
- `messages` echoes the assistant output plus optional guard-system notes.
- `usage`, `sources`, and `context*` support analytics and debugging.

## Common Error Responses
| Status | Description | Next Steps |
|--------|-------------|------------|
| `400` | Invalid JSON or missing user question | Validate the body and ensure a user turn exists. |
| `401` | Missing/incorrect `X-Web-Api-Key` | Provide the exact `ORACLE_WEB_API_TOKEN` value. |
| `401` | Missing signature headers | Supply `X-Oracle-Key`, `X-Oracle-Timestamp`, and `X-Oracle-Signature`. |
| `403` | Unknown `X-Oracle-Key` | Configure the key via `ORACLE_API_KEYS_JSON` or `config.json`. |
| `504` | Processing exceeded 10 seconds | Retry with backoff; inspect server load. |
| `502` | Upstream provider failure | Typically transient Anthropic/Firebase issues; retry and monitor. |

Keep this reference aligned with the latest backend contract (`infra/keep_alive.py`) and configuration (`config/settings.py`).

````