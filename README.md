# MAG 學習室 — Pi technical validation

Small local slice: import real material → Pi plans small steps → constrained tool writes synchronized narration/board → interrupt with「這裡不懂」→ clarification → resume the exact original cursor → next step. Learner UI is Traditional Chinese. This is not a commercial platform.


## UI revision status

Home and classroom are now separate views. Home includes a goal composer with attached/pasted material, working sample prompts, collapsible navigation, and an actual current-session continue card. Returning home pauses teaching and preserves the checkpoint. Classroom focuses on the current step; previous-step review does not advance Pi. The teacher icon is explicitly static. Model/voice details are available through a compact status control.

**Visual-reference matching is blocked, not completed:** Library resolved the three requested Hyperknow/Muse image IDs, but image downloads were blocked by proxy HTTP 403, so their pixels were not inspected. This is a functional checkpoint using the existing MAG visual baseline, not a claimed faithful recreation. See [design QA status](design-qa.md).

## Run

Node **22.19+** (verified on 24.19), npm, a browser.

```sh
npm ci
npm run dev
# http://127.0.0.1:5173 — LIVE Pi mode, no automatic mock fallback
```

No credential is needed to start the site or import materials. Starting live teaching needs an authorized model. To exercise the interaction without one:

```sh
MAG_MODE=fixture npm run dev
```

The banner says **離線互動測試**. This uses the real Pi SDK agent/tool loop with an explicit deterministic **model fixture**. It quotes the uploaded material; it does not understand questions or prove teaching quality.

```sh
npm run build
npm start                         # production assets, same API
MAG_MODE=fixture PORT=5174 npm start  # separate offline preview
```

Default bind is loopback. No public deployment is configured. Sessions/materials are in memory; restart or page reload starts a fresh learner session. Old sessions expire opportunistically on the next import after one hour; maximum 20 concurrent sessions. “換一份教材” disposes the previous Pi session. Intended for a single trusted local user, not internet hosting.

## Existing model setup (server side only)

In the **cloud environment's protected Secrets/environment settings**, set an already-authorized provider key. Do not put it in chat, source control, the browser or a `VITE_*` variable. No new subscription or account setup is required or performed.

A supported catalog example:

- Secret: `ANTHROPIC_API_KEY` (existing authorized value).
- Non-secret settings: `PI_PROVIDER=anthropic`, `PI_MODEL=claude-sonnet-4-5`, `MAG_MODE=live`.
- Restart the server, then `npm run check:pi` to verify real planning and board tool calls. This issues a model request when credentials are available; ordinary provider usage/billing applies.

Alternatively use an existing supported Pi provider, e.g. `OPENAI_API_KEY` with `PI_PROVIDER=openai` and its authorized `PI_MODEL` id. Pi's available-model catalog must contain the selected model. Existing Pi auth can be read via `PI_AUTH_PATH=/absolute/path/to/auth.json`; custom model setup via `PI_MODELS_PATH=/absolute/path/to/models.json`. Existing `~/.pi/agent/auth.json` is discovered if present. No login or persistent access was configured by this task.

For local development outside managed secrets, copy `.env.example` to ignored `.env` and fill it privately. The dev/start/check commands load it with Node's `--env-file-if-exists`. `.pi-local/` is ignored and holds local Pi metadata; auth values are never returned by the API or diagnostics. Server errors are sanitized.

**Current executor blocker:** Pi reported **0 available live models**. No live model request was made. The successful SDK/tool-loop checks used the explicitly labeled fixture, not live inference.

## Supported material import

- Upload actual `.txt` / `.md` UTF-8 files, or paste text.
- 40–40,000 characters, at most 64 KB UTF-8 and 800 lines.
- Reject binary/invalid UTF-8, unsupported extension, empty and oversized input.
- Included source-backed TypeScript sample for learners with weak JavaScript foundations.
- No URL fetching, PDF/OCR, images or arbitrary file execution.

The “教材與來源” panel shows normalized line-numbered content and SHA-256. Every plan step and board beat requires exact quotes with valid line ranges. Uploaded sources remain “使用者提供；尚未外部查證”. All material is treated as untrusted data; model tools cannot execute it. Text and code render as text nodes; no raw HTML/SVG or arbitrary model coordinates. Flow drawings permit only 2–4 bounded labels and host-owned SVG geometry.

## Timing, interruption and voice

The homepage learning goal is validated separately and sent to Pi without changing the source text, line numbers or fingerprint. A goal never substitutes for material.

One Pi tool beat = one short narration plus one text/code/flow board object. Both render against the same Unicode character cursor; model context uses the same visible-board projection. Reading completes before “下一步” is enabled; no automatic next-step rush.

On question/pause the client immediately freezes writing and cancels speech. The server awaits Pi abort, invalidates the generation, and rejects stale writes. It also handles cancellation racing Pi's asynchronous prompt preflight. Questions carry the selected board beat and displayed cursor. Clarification does not advance the course. Resume continues the original saved content rather than regenerating it or duplicating it. Subsequent teaching uses the same Pi conversation, including the clarification. Request UUID deduplication and revision checks protect repeated actions. Errors remain visible and retryable; failed live generation never quietly switches to fixtures.

Voice is a separate **experimental browser bridge**, not a Pi realtime audio model:
- Opt-in SpeechSynthesis playback; cancel on pause/question/new material.
- Feature-detected SpeechRecognition with `zh-TW`, one explicit microphone capture, one final transcript → the same contextual question endpoint. Teaching is paused before capture to avoid echo; permission/network errors fall back to text.
- Browser vendors may process recognition audio remotely. No additional voice provider account is configured.
- **Not full-duplex realtime voice. Not word-level audio/board synchronization.** Text drives the board; speech plays independently. No real microphone/audio service was available for verification. Browser API doubles test the bridge only.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser   # Chromium at /usr/bin/chromium, or set CHROMIUM_PATH
npm run check:pi       # live; exits 2 when no credentials are available
MAG_MODE=fixture npm run check:pi  # real Pi loop, mocked model output
```

Playwright starts an isolated fixture server at 5174 (uses an existing one outside CI). It checks real browser interaction, UTF-8 upload, source inspection, progressive text, interruption/clarification/resume, mobile layout, literal markup, transport failure, voice bridge with mocked browser audio, and code/SVG rendering with an injected visual fixture. PNG evidence lives in `docs/evidence/`. See [validation report](docs/validation.md) for the final executed results and boundaries, and [reuse decision](docs/reuse.md) for upstream source/license details.

## Main files

- `server/pi.ts`: official Pi SDK/session/tool integration and isolated resources.
- `server/lesson.ts`: presentation checkpoints, cancellation, retries and idempotent actions.
- `server/material.ts`, `samples/typescript-intro.md`: real import, provenance and source-backed sample.
- `server/app.ts`, `server/index.ts`: same-origin local API and dev/production startup.
- `shared/contracts.ts`: bounded schemas and shared visible-content projection.
- `src/Home.tsx`, `src/Classroom.tsx`, `src/useLearningRoom.ts`, `src/ModeStatus.tsx`, `src/BoardVisual.tsx`, `src/main.tsx`, `src/style.css`, `src/voice.tsx`, `src/arrow-head.ts`: learner UI, board, voice bridge and attributed geometry.
- `server/fixture.ts`, `tests/`, `scripts/check-pi.ts`: explicit offline fixture and verification.

Deferred: persistence/auth/multiuser, arbitrary media, live teaching-quality evaluation, full realtime voice/precise audio alignment and dimensional avatar. None blocks the core text validation.
