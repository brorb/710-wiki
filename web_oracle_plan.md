# Web Oracle Persona Plan

_Last updated: 2025-10-31_

---

## 1. Objective
Deliver a web-specific Oracle experience that feels intentional for browser users while continuing to share the mature Discord pipeline where possible. The web Oracle must:
- Provide richer navigation cues (explicit link descriptions, section pointers, suggested follow-ups).
- Respect the strengthened link sanitization rules and wiki metadata model.
- Offer a distinct persona tone tailored to web consumption without fragmenting business logic.
- Preserve observability, security, and reliability requirements already in place for the API.

## 2. Guiding Principles
1. **Single Source of Truth** – Keep retrieval, ranking, and sanitization logic shared; branch only where UX demands it.
2. **Configuration Driven** – Environment flags and prompt templates dictate channel-specific behavior rather than hard-coded forks.
3. **Progressive Delivery** – Ship in tested increments behind feature flags to keep Discord experience stable.
4. **Observability First** – Instrument each change so we can measure impact (success funnels, error rates, link follow-through).
5. **Secure by Default** – Reuse the HMAC/token gates, add CORS discipline, and require explicit credential injection from the web client.

## 3. Phase Plan

### Phase 0 — Preconditions & Hardening
- [x] **CORS Support**: `infra/keep_alive.py` now serves `Access-Control-Allow-*` headers driven by `config.json > oracle_api.allowed_origins` with wildcard localhost support and preflight short-circuiting.
- [ ] **Client Credential Injection**: Update the web widget to attach `X-Oracle-Signature` (legacy `X-Oraculum-Signature`) + `X-Web-Api-Key` consistently; add config guardrails so missing headers surface developer-friendly errors.
- [ ] **Logging Parity**: Confirm Firebase web collection (`FIREBASE_WEB_CONVERSATION_LOG_URL`) is populated; add error logging for header validation failures.
- [x] **Environment Checklist**: `README.md` documents `ORACLE_WEB_API_TOKEN`, `ORACLE_ALLOWED_ORIGINS`, `ORACLE_ALLOW_LOCALHOST_ORIGINS`, and `ORACLE_CORS_MAX_AGE` overrides for deployment.

### Phase 1 — Persona & Prompt Separation
- [x] **Prompt Assets**: `system_prompt_web.txt` now defines a web-specific persona focused on site navigation, linked evidence, and gentle follow-ups.
- [x] **Config Toggle**: `config/settings.py` exposes `SYSTEM_PROMPT_WEB_FILE`, channel choices, and `ORACLE_DEFAULT_CHANNEL`; Discord and HTTP entrypoints pass their channel explicitly.
- [x] **Loader Awareness**: `infra/keep_alive` sets `OracleRequest(channel="web")`, and both Discord + web paths pass the channel through caching and Claude calls.
- [x] **Unit Coverage**: `tests/test_prompts.py` asserts that `load_system_prompt` resolves different files per channel.

### Phase 2 — Context Packaging for Web
- [x] **Navigation Slots**: `oracle.web_payload.build_web_payload` returns `lead`, `contextSnippets`, `sources`, `followUpQuestions`, and `callToAction`, surfaced via the `webPayload` field.
- [x] **Snippet Builder**: Snippets stitch chunk metadata with wiki URLs/strengths, using alias scores to describe each source inline.
- [x] **Follow-up Suggestions**: Resolver hits seed 2–3 follow-up prompts, with heuristics falling back to secondary chunks and question context.
- [x] **Data Contracts**: `docs/web_api/endpoint_reference.md` documents the new schema; tests cover prompt selection and payload generation.

### Phase 3 — Post-Processing Enhancements
- [x] **Link Formatter**: Extend `bot/post_processing.py` to emit web-friendly `<a>` markup or structured link objects depending on client expectation.
- [x] **Disclaimers & Safety Rails**: Append channel-specific disclaimers (e.g., citation freshness) and ensure they coexist with sanitizer rules.
- [x] **Alias Confidence Display**: Surface alias `strength` metadata when relevant (e.g., “Experimental” labels for low confidence links).
- [x] **Regression Tests**: Expand sanitizer tests to cover the new response schema and ensure no numeric-only anchors leak through.

### Phase 4 — UI Integration & Instrumentation
- [x] **Integration Doc**: `docs/web_frontend_integration.md` defines rendering, instrumentation, fallback, and accessibility expectations for the web client.
- [ ] **Frontend Consumption**: Update web UI components to parse the richer response (headings, tables, follow-ups).
- [ ] **Analytics Hooks**: Emit events for question asked, link clicked, follow-up selected; ensure metrics pipe into existing analytics stack.
- [ ] **Fallback UX**: Define degraded behavior if response lacks links (clear messaging + ask for rephrase buttons).
- [ ] **Accessibility Review**: Check typography, ARIA labels, and keyboard navigation for the new layout.

### Phase 5 — QA, Launch, and Maintenance
- [ ] **End-to-End Verification**: Run channel-specific regression suite (API contract, sanitizer, prompt output).
- [ ] **Dogfooding**: Internal beta with logging dashboard to capture qualitative feedback.
- [ ] **Go/No-Go Checklist**: Security sign-off (headers, CORS), analytics verification, documentation updates.
- [ ] **Launch Plan**: Enable feature flag for production web domain; monitor metrics; prepare rollback procedure.
- [ ] **Maintenance Cadence**: Schedule monthly prompt review, quarterly link metadata auditing, and logging health checks.

## 4. Dependencies & Open Questions
- **CORS Policy**: Need product decision on allowed origins list and whether to support partner embeds.
- **Prompt Authoring**: Confirm tone, voice, and guardrails for the web persona with stakeholders.
- **Front-End Ownership**: Clarify who integrates the richer response on the web client and how we coordinate releases.
- **Analytics Stack**: Determine preferred sink (existing Firebase collection, new dashboard, or third-party tool).
- **Follow-up Suggestion Logic**: Decide between LLM-generated vs. heuristic suggestions for lower latency.

## 5. Tracking & Next Steps
- Maintain this document alongside implementation tickets.
- Reference this plan before starting any web-Oraculum work to ensure alignment.
- Update the checkboxes and notes as tasks complete; record deviations so future contributors understand context.

---

_This plan consolidates the agreed direction for differentiating the web Oracle experience. All future implementation steps should consult this document first to stay consistent with the vision and constraints._
