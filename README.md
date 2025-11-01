# 7/10 Tone Sleuth Wiki

This is the information hub for everything related to the 7/10 Tone project and the custom Quartz build that powers https://www.710tone.wiki/.

## Graph view tuning

The local and global graph defaults live in `quartz-site/quartz/components/Graph.tsx`. You can tweak them without editing the Pixi renderer:

- `fontSize`: baseline text size (in `rem` units) for node labels.
- `opacityScale`: how quickly labels fade as you zoom out.
- `labelVisibility`: fine-grained control over when labels become readable. It accepts:
	- `minAlpha` / `maxAlpha`: lower/upper bounds for label opacity (0–1).
	- `startZoom` / `endZoom`: zoom factors where the fade starts and reaches full opacity.

The defaults are exposed in the `defaultOptions` object so you can copy/paste the block straight into `quartz.layout.ts` and override just the fields you care about, e.g.

```ts
Component.Graph({
	localGraph: {
		fontSize: 0.9,
		opacityScale: 1.8,
		labelVisibility: {
			minAlpha: 0.4,
			maxAlpha: 1,
			startZoom: 0.7,
			endZoom: 2.2,
		},
	},
})
```

## Media playback normalisation

An inline script (`quartz-site/quartz/components/scripts/mediaNormalizer.inline.ts`) now normalises every `<audio>` and `<video>` element. It applies a shared volume baseline, a gentle gain boost, and a dynamics compressor so loud clips stop spiking.

You can adjust the behaviour globally by adding attributes to `<html>` (or by editing the defaults in the script):

| Attribute | Purpose | Default |
| --- | --- | --- |
| `data-media-normalize-volume` | Initial media element volume (0–1) | `0.38` |
| `data-media-normalize-gain` | Post-compressor gain (0–1) | `0.82` |
| `data-media-normalize-threshold` | Compressor threshold (dB) | `-26` |
| `data-media-normalize-knee` | Compressor knee (dB) | `22` |
| `data-media-normalize-ratio` | Compression ratio | `12` |
| `data-media-normalize-attack` | Attack time (seconds) | `0.003` |
| `data-media-normalize-release` | Release time (seconds) | `0.25` |

Per-player overrides are available with matching `data-media-normalize-*` attributes on the individual `<audio>`/`<video>` tag.

## ORA_CLE chat widget

The desktop right sidebar surfaces an “Ask ORA_CLE” launcher that opens the full-screen dialog. The widget stores the conversation in `localStorage`, so readers keep their transcript across page loads and SPA navigations.

### Configuration hooks

	- `enabled`: set to `false` to hide the UI without touching templates.
	- `apiBaseUrl`: absolute base for the hosted inference service. Defaults to the Railway production URL.
	- `endpointPath`: path (or absolute URL) that receives chat POSTs. Defaults to `/api/oracle/query`.
	- `recaptchaSiteKey`: reCAPTCHA v3 site key. When present the client lazily loads Google’s script and attaches a `captchaToken` per request.
	- `storageKey`: override the browser key if you need to migrate existing conversations.
	- `maxHistory`: maximum number of user/assistant turns that travel with each API call. Defaults to 24.
	- `webApiKey`: **required**. Populated via `ORACLE_WEB_API_TOKEN`; becomes the `X-Web-Api-Key` header.
	- `oracleKeyId`: **required** identifier for the signing key (e.g. `wiki-widget`). Set via `ORACLE_KEY_ID` (falls back to the legacy `ORACLE_SIGNING_KEY_ID`); surfaces as `X-Oracle-Key`.
	- `oracleSigningSecret`: **required** shared secret used to HMAC sign each payload. Populate via `ORACLE_KEY_SECRET` (falls back to `ORACLE_SIGNING_SECRET`). The static site ships this value to the browser so treat it as a scoped credential.
	- Railway often displays widget variables as `${{shared.*}}` indirections—copy the resolved string (for example `t6FZ…`) from the Oracle hosting app, not the literal `${{...}}` placeholder.
	- `ORACLE_WEB_API_TOKEN=<token>`
	- `ORACLE_KEY_ID=<signing key id>`
	- `ORACLE_KEY_SECRET=<signing secret>`
  so the Quartz CLI can pick them up while building or serving the site.

### Request lifecycle

1. The inline script locates every `.oracle-widget` element, reads its `data-*` attributes, and builds the target URL from `apiBaseUrl` + `endpointPath`.
2. Whenever the user submits a prompt the script:
	- Pulls stored state from `localStorage` using `configuration.oracleChat.storageKey` (default `"oracle-chat-history"`).
	- Trims the stored `user`/`assistant` turns down to the most recent `maxHistory` entries.
	- Appends the new `user` message, generating a stable payload.
	- Requests a reCAPTCHA token if a site key is configured.
	- Aborts any in-flight fetch, HMAC-signs `timestamp.body` using `oracleSigningSecret`, and POSTs JSON to the configured endpoint with the `X-Web-Api-Key`, `X-Oracle-Key`, `X-Oracle-Timestamp`, `X-Oracle-Signature`, and `X-Oracle-Channel: web` headers.
3. Responses update the local transcript, persist the conversation (still capped to `maxHistory`), and refresh the chat window. Errors append an `oracle-chat__message--error` bubble with the message returned by the rejected promise.

### Request payload

Every submission POSTs a body shaped like (headers listed above are always present when the widget is enabled):

```json
{
	"conversationId": "optional-stable-id-or-null",
	"question": "Current user question",
	"messages": [
		{ "role": "assistant", "content": "The previous answer" },
		{ "role": "user", "content": "The previous question" },
		{ "role": "user", "content": "Current question" }
	],
	"metadata": {
		"origin": "710tone.wiki",
		"path": "/Characters/SYSTEM",
		"url": "https://www.710tone.wiki/Characters/SYSTEM",
		"article": {
			"title": "SYSTEM",
			"slug": "Characters/SYSTEM"
		},
		"history": {
			"includedMessages": 2,
			"windowSize": 24,
			"totalMessages": 5
		},
		"timestamp": "2025-10-30T18:22:11.000Z",
		"channel": "web"
	},
	"priority": "medium",
	"sections": 18,
	"creativeMode": false,
	"captchaToken": "optional-recaptcha-token",
	"channel": "web"
}
```

- `conversationId` echoes whatever the server last returned. The client sends `null` until the service supplies a stable ID, letting the backend resume threads.
- `question` always mirrors the latest user turn. The backend can ignore it when `messages` ends with a user role, but the field is present for explicit validation.
- `messages` contains only `user` and `assistant` roles. Pending placeholders are stripped before the request payload is assembled. The list is truncated to the newest `maxHistory` turns _before_ appending the fresh user prompt, so the backend sees at most `maxHistory + 1` entries.
- `metadata.origin` derives from `window.location.hostname`. `metadata.path` and `metadata.url` capture the current page; `metadata.article` repeats the article title/slug taken from Quartz frontmatter, and `metadata.history` mirrors the snapshot of the local transcript. We do not collect the client IP on the frontend; supply it at the edge if needed.
- `metadata.history` exposes the snapshot of the local transcript: how many turns are included (`includedMessages`), the configured window (`windowSize`), and how many total messages exist client-side (`totalMessages`, including system/error entries).
- `metadata.timestamp` is generated in UTC ISO-8601 format for logging and rate limiting.
- `priority` defaults to `"medium"`, `sections` reflects the number of headings detected on the page (or is omitted when none are found), and `creativeMode` is `false`. Adjust these before POSTing if business logic changes.
- `captchaToken` appears only when reCAPTCHA is active; validate it server-side via Google’s `siteverify` endpoint.

### Expected response

The UI accepts any JSON superset of this shape:

```json
{
	"conversationId": "uuid-or-stable-id",
	"reply": "Plain-text fallback for browsers that do not support the structured payload.",
	"webPayload": {
		"lead": "High-signal answer that opens the response",
		"answer": "Optional secondary paragraph with additional framing",
		"contextSnippets": [
			{
				"title": "SYSTEM",
				"summary": "Key takeaway pulled from the indexed chunk",
				"url": "https://www.710tone.wiki/Characters/SYSTEM",
				"section": "Transmission Log",
				"strength": "Canonical",
				"alias": "SYSTEM"
			}
		],
		"sources": [
			{
				"title": "TTH: Signal 849",
				"description": "Audio log recovered from CIN Center archive",
				"url": "https://www.710tone.wiki/Media/710-Media/Audio/SIGNAL849-(1).mp3",
				"strength": "Primary"
			}
		],
		"followUpQuestions": [
			"What other CIN Center transmissions mention SYSTEM?",
			"Where should I look next if I want footage instead of audio?"
		],
		"callToAction": "Skim the CIN Centers concept note for the full patrol roster.",
		"disclaimers": ["Citations reference the latest nightly Quartz build (UTC)."]
	},
	"messages": [
		{ "role": "assistant", "content": "(optional) last answer" },
		{ "role": "system", "content": "(optional) follow-up notice" }
	],
	"disclaimers": ["Audio clips may take a moment to buffer when fetched from the CDN."],
	"success": true
}
```

- Always respond with `200 OK` and `application/json` when the prompt succeeds. Non-2xx codes surface a generic error bubble whose text includes the thrown error message.
- `conversationId` can be anything JSON-serialisable. Returning `null` clears the stored ID; otherwise it is persisted for the next request.
- `reply` populates the rendered assistant bubble when the richer `webPayload` field is absent. When both are present, the lead section of `webPayload` is shown first and `reply` becomes a plain-text fallback.
- `webPayload` unlocks the web persona experience: the widget renders `lead`, `answer`, context `snippets`, structured `sources`, suggested follow-ups, an optional call to action, and any channel-specific `disclaimers` in dedicated UI sections.
- `messages` is useful for out-of-band machine instructions. Entries with the `assistant` role will display if `reply` is missing; `system` entries are stored but not rendered.
- `disclaimers` (top-level) supplement the structured payload with extra notices. They are merged with `webPayload.disclaimers` and rendered near the footer of each assistant turn.
- The client ignores unknown top-level properties, so you can include diagnostics (latency, tokens, etc.) without breaking compatibility.
- Additional response metadata such as `success`, `reason`, `usage`, or `guardFlags` are preserved for logs; the UI highlights `webPayload`, `reply`, and `messages` when present.

### Error handling and rate limits

- Timeouts or network failures raise an error that the UI renders inside an `oracle-chat__message--error` bubble. The user can immediately retry.
- The client throttles submissions to once every `1.2 s` (`SEND_COOLDOWN_MS`). Backends can safely return HTTP `429` with a message; the text will show in the same error bubble.
- The Reset button clears `conversationId` and the stored transcript, forcing the next API call to look like a fresh session.

### Client behaviour recap

- The chat window teleports to the document `<body>` on open so its overlay sits above the info box and sidebars. `document.body` receives the `oracle-chat-active` class while the dialog is visible.
- Assistant replies render a structured layout when `webPayload` is present: lead summary, supporting paragraphs, inline context cards, curated sources, CTA copy, and suggested follow-ups.
- When the backend withholds links, the widget shows a fallback notice along with ready-to-send follow-up prompts so readers can ask for citations or pivot topics quickly.
- `Enter` submits; `Shift+Enter` inserts a newline. The textarea auto-grows to `240px`.
- Local transcripts never exceed `maxHistory` persisted entries, even though `metadata.history.totalMessages` tracks the uncapped count for observability.
- The widget eagerly focuses the textarea and scrolls to the latest message whenever it opens or the history updates.
- When reCAPTCHA is configured, the script loads Google’s client the first time the dialog opens and reuses it for later submissions.
- Each assistant turn and user action emits an `oracle-analytics` `CustomEvent` on both `window` and `document`. Consumers can listen for `detail.event` values such as `oracle:question-submitted`, `oracle:response-received`, `oracle:link-clicked`, `oracle:followups-presented`, `oracle:followup-selected`, and `oracle:fallback-presented` to wire telemetry.

### Analytics hooks

Listen for the `oracle-analytics` event to pipe metrics into your preferred sink:

```ts
window.addEventListener("oracle-analytics", (event) => {
	const { event: name, detail, timestamp } = event.detail
	// Forward to your analytics service
})
```

Each `detail` payload includes the conversation ID when available plus context-specific fields (e.g., `sourceCount` for `oracle:response-received`, `url`/`kind` for `oracle:link-clicked`).

### CORS troubleshooting & proxy shim

- The Railway endpoint at `https://discord-system-firebase-bot-production.up.railway.app/api/oracle/query` does **not** return `Access-Control-Allow-Origin`, so browsers block preflight requests from both `http://localhost:*` and `https://710tone.wiki`. Verify with:

	```bash
	curl -i -X OPTIONS https://discord-system-firebase-bot-production.up.railway.app/api/oracle/query \
		-H "Origin: https://710tone.wiki" \
		-H "Access-Control-Request-Method: POST" \
		-H "Access-Control-Request-Headers: content-type,x-web-api-key,x-oracle-key,x-oracle-timestamp,x-oracle-signature"
	```

	The response reports `200 OK` but lacks any `Access-Control-Allow-*` headers, so the real POST never fires in the browser.
- Update the hosted service to emit the appropriate headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`) for `https://710tone.wiki` and local origins when possible. Until that’s in place, local development can rely on the lightweight proxy below.
- `node scripts/oracle-proxy.mjs` starts a CORS-aware relay that forwards `/api/oracle/query` requests to the Railway API using the same headers the widget already computes. It responds to preflight with the permissive headers Chrome expects and mirrors the upstream JSON payload.
- Usage:
	1. `npm run build -w quartz-site`
	2. `npm run oracle:proxy` (default port `8787` — override with `ORACLE_PROXY_PORT`)
	3. `ORACLE_WEB_API_BASE_URL=http://localhost:8787` when building/serving locally so the widget targets the proxy. For one-off runs you can export the variable inline: `ORACLE_WEB_API_BASE_URL=http://localhost:8787 npm run build -w quartz-site`.
- The proxy reads `ORACLE_WEB_API_TOKEN` / `ORACLE_KEY_ID` from your `.env` and logs every forward along with the byte size and HTTP status. Health check: `curl http://localhost:8787/health`.

## Inline media boxes

- Drop a fenced code block with the language `media-box` anywhere in a note to render a framed figure that can host images, video, or audio alongside optional title, caption, credit, alignment, and wrapping rules. The transformer understands plain URLs, repo-relative paths, and Obsidian embeds for the `Media:` field.
- Supported fields: `Title`, `Media`/`Src`/`Image`, `Alt`, `Caption`, `Credit`, `Align` (`left`/`center`/`right`), `Wrap` (`true`/`false`), `Width` (e.g. `260px`, `clamp(220px, 32vw, 360px)`), `Link` (image-only anchor), `Type` (`image`/`video`/`audio`), `Poster` (video poster frame), and playback flags (`Autoplay`, `Loop`, `Muted`). Additional indented lines continue the previous field, which makes multiline captions easy.
- Example:

	```media-box
	Title: Station Array Blueprint
	Media: /static/oracle-pfp.png
	Alt: Placeholder blueprint artwork
	Caption: Use `Wrap: false` when you want the figure to stand alone.
	Align: center
	Wrap: false
	Width: clamp(220px, 32vw, 360px)
	```

- Drop two or more `media-box` fences back-to-back to form a single flex row; Quartz will line them up on wide screens and fall back to a column on mobile.

- See `Content/Guides/Custom Formatting Reference.md` for comprehensive examples (floating variants, audio/video embeds, credits, and more). On mobile (<900 px) wrapped boxes automatically drop into the normal flow so text remains readable.
