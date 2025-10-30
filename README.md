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

- Update `quartz-site/quartz.config.ts` under `configuration.oracleChat`:
	- `enabled`: set to `false` to hide the UI without touching templates.
	- `apiBaseUrl`: absolute base for the hosted inference service. Defaults to the Railway production URL.
	- `endpointPath`: path (or absolute URL) that receives chat POSTs. Defaults to `/api/oracle/query`.
	- `recaptchaSiteKey`: reCAPTCHA v3 site key. When present the client lazily loads Google’s script and attaches a `captchaToken` per request.
	- `storageKey`: override the browser key if you need to migrate existing conversations.
	- `maxHistory`: maximum number of user/assistant turns that travel with each API call. Defaults to 24.
	- `webApiKey`: **required**. Populated via `ORACLE_WEB_API_TOKEN`; becomes the `X-Web-Api-Key` header.
	- `oracleKeyId`: **required** identifier for the signing key (e.g. `wiki-widget`). Set via `ORACLE_KEY_ID` (falls back to the legacy `ORACLE_SIGNING_KEY_ID`); surfaces as `X-Oracle-Key`.
	- `oracleSigningSecret`: **required** shared secret used to HMAC sign each payload. Populate via `ORACLE_KEY_SECRET` (falls back to `ORACLE_SIGNING_SECRET`). The static site ships this value to the browser so treat it as a scoped credential.
- The widget avatar lives at `quartz-site/quartz/static/oracle-pfp.png`; swap the file to update the branding.
- For local development, create a `.env` file at the repository root with:
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
	- Aborts any in-flight fetch, HMAC-signs `timestamp.body` using `oracleSigningSecret`, and POSTs JSON to the configured endpoint with the `X-Web-Api-Key`, `X-Oracle-Key`, `X-Oracle-Timestamp`, and `X-Oracle-Signature` headers.
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
		"timestamp": "2025-10-30T18:22:11.000Z"
	},
	"priority": "medium",
	"sections": 18,
	"creativeMode": false,
	"captchaToken": "optional-recaptcha-token"
}
```

- `conversationId` echoes whatever the server last returned. The client sends `null` until the service supplies a stable ID, letting the backend resume threads.
- `question` always mirrors the latest user turn. The backend can ignore it when `messages` ends with a user role, but the field is present for explicit validation.
- `messages` contains only `user` and `assistant` roles. The list is truncated to the newest `maxHistory` turns _before_ appending the fresh user prompt, so the backend sees at most `maxHistory + 1` entries.
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
	"reply": "Markdown-safe text for the assistant bubble.",
	"messages": [
		{ "role": "assistant", "content": "(optional) last answer" },
		{ "role": "system", "content": "(optional) follow-up notice" }
	]
}
```

- Always respond with `200 OK` and `application/json` when the prompt succeeds. Non-2xx codes surface a generic error bubble whose text includes the thrown error message.
- `conversationId` can be anything JSON-serialisable. Returning `null` clears the stored ID; otherwise it is persisted for the next request.
- `reply` populates the rendered assistant bubble. When omitted, the client falls back to the last `assistant` message in the optional `messages` array.
- `messages` is useful for out-of-band machine instructions. Entries with the `assistant` role will display if `reply` is missing; `system` entries are stored but not rendered.
- The client ignores unknown top-level properties, so you can include diagnostics (latency, tokens, etc.) without breaking compatibility.
- Additional response metadata such as `success`, `reason`, `usage`, or `guardFlags` are preserved but currently only `reply` and `messages` influence the UI.

### Error handling and rate limits

- Timeouts or network failures raise an error that the UI renders inside an `oracle-chat__message--error` bubble. The user can immediately retry.
- The client throttles submissions to once every `1.2 s` (`SEND_COOLDOWN_MS`). Backends can safely return HTTP `429` with a message; the text will show in the same error bubble.
- The Reset button clears `conversationId` and the stored transcript, forcing the next API call to look like a fresh session.

### Client behaviour recap

- The chat window teleports to the document `<body>` on open so its overlay sits above the info box and sidebars. `document.body` receives the `oracle-chat-active` class while the dialog is visible.
- `Enter` submits; `Shift+Enter` inserts a newline. The textarea auto-grows to `240px`.
- Local transcripts never exceed `maxHistory` persisted entries, even though `metadata.history.totalMessages` tracks the uncapped count for observability.
- The widget eagerly focuses the textarea and scrolls to the latest message whenever it opens or the history updates.
- When reCAPTCHA is configured, the script loads Google’s client the first time the dialog opens and reuses it for later submissions.
