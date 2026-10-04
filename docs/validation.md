# Executed validation — 2026-10-04

Repository: `/workspace/aiteacher` → `https://github.com/ynyyzyrf/aiteacher.git`, branch `work` (unborn / no commits). Initially empty; no existing application or local instructions/skills were present. All deliverables are new working-tree files; no push, PR or deployment.

## Current UI revision boundary

Reference-image fidelity is **BLOCKED**: actual pixels of the three user-selected Library references could not be materialized because of proxy HTTP 403. No visual-matching claim is made. Independent functional changes were completed in the existing repository; detailed status is in `../design-qa.md`. New screenshots show the implemented functional checkpoint, not a verified match to the references.

## Results

| Check | Executed result | Boundary |
| --- | --- | --- |
| `npm ci` | PASS, 366 packages installed from lockfile | Node 24.19.0 / npm 11.9.0 in configured executor |
| `npm run typecheck` | PASS | Includes official Pi SDK and custom tool signatures |
| `npm run lint` | PASS | ESLint / TypeScript rules |
| `npm test` | PASS, 23 tests across 3 files | Real Pi loop with deterministic model fixture; material, state and HTTP tests |
| `npm run build` | PASS | Production Vite assets, no external font fetch needed |
| `npm run test:browser` | PASS, 12 Chromium tests | Real rendered UI and HTTP server; model explicitly mocked |
| Production live startup | PASS | Browser loads built assets, imports sample, displays precise missing-model error; zero board beats and no page errors |
| Production fixture startup | PASS | Built assets run full Pi tool loop and show board; no Vite client in production |
| `npm run check:pi` | BLOCKED as expected, exit 2 | **0 available live models; no live model request made** |
| `MAG_MODE=fixture npm run check:pi` | PASS | `plan_lesson` and `board_beat` executed through Pi; only those tools active; **mock model output** |
| Live teaching accuracy | NOT RUN | Requires existing authorized model credential |
| Actual microphone / audible playback | NOT VERIFIED | No physical microphone or live recognition/audio verification; API doubles only |
| Full-duplex realtime voice / audio word alignment | NOT IMPLEMENTED | Browser half-duplex experiment; board and speech clocks are separate |

## Tested behavior

UI revision adds verified home expanded/collapsed state and recentering, real navigation, learning-goal transmission, integrated file/paste material entry, double-click deduplication, meaningful sample prompts, home-to-classroom and return transitions, pause-before-home, same-beat continuation, previous-step review without progress mutation, and mobile navigation/long-filename overflow checks. All prior teaching/voice/renderer checks still run with the new UI.


- Genuine arbitrary Markdown/text import over HTTP and browser file upload; Traditional Chinese, Unicode, CRLF normalization, line count, SHA-256 and origin.
- Empty, invalid-format, binary/control-character, oversized and excessive-line materials; malformed JSON, cross-origin mutation and missing sessions.
- Exact source quotes and line ranges; bounded plan/narration/visual schemas. Imported HTML-like source stays literal text and never executes.
- Pi itself creates the plan and invokes tools in the fixture run. Custom resource loader and active-tool check prove no coding tools are enabled.
- Narration and board use the same character cursor and projection. Code and SVG flow renderer checked in Chromium with an explicitly injected visual fixture (not live model drawing).
- Interruption freezes the original displayed content, aborts Pi, adds a clarification, leaves the step unchanged, then resumes the original beat/cursor. Repeated questions preserve the original resume checkpoint.
- Repeated request IDs, stale revision and late playback acknowledgments do not double-advance. Generation canceled while moving to the next step does not skip that step. Completion stays inside plan bounds.
- A discovered cancellation race during Pi's async prompt preflight was fixed by invalidating epochs and canceling again at `agent_start`. Regression test covers it.
- Bounded generation timeout, visible retry state, no late tool mutation after abort. No automatic switch from live to fixture.
- Real browser network failure stops writing. Mobile 390px layout has no horizontal overflow; sidebar question entry remains usable.
- Voice API doubles verify opt-in speech playback, cancellation before mic capture, one final transcript submitted once, and microphone-denial fallback. This is wiring evidence, not real speech quality or live audio evidence.
- Development-server HMR ports are separate per app port; the discovered two-preview port collision was fixed. Final browser suite had no application page errors.

## View evidence

- [Desktop import](evidence/import-desktop.png)
- [Interrupted lesson and clarification](evidence/clarification-desktop.png)
- [Mobile](evidence/mobile.png)
- [Live-mode credential blocker](evidence/live-model-blocker.png)

All successful lesson screenshots use the visible **離線互動測試** banner. The sample citations were reviewed against official TypeScript docs (see [reuse/provenance record](reuse.md)); exact quote checks do not prove a future model's explanation is logically entailed by them.

## Smallest remaining blocker and next verification

Set an **existing** authorized provider secret in this executor's secure environment settings, e.g. `ANTHROPIC_API_KEY`, with `PI_PROVIDER=anthropic`, `PI_MODEL=claude-sonnet-4-5`, `MAG_MODE=live`; restart. No secret should be sent in chat. No credentials, subscription or account/security settings were changed here. Run `npm run check:pi`, then repeat the browser scenario on live mode and assess explanation correctness, weak-JS pacing, citation entailment, code/diagram alignment and context-sensitive clarification. Real microphone/playback then needs a capable browser, explicit permission and human audio inspection; full realtime audio is a further integration.

## Known slice limits

No durable progress, authentication/multiuser deployment, PDF/OCR/URL import, learned mastery, code execution, avatar or general whiteboard editor. Sessions stay in process memory, capped at 20; reload does not restore learner UI. Quotes are mechanically checked, semantic truth is not. Model generation can still fail or give low-quality teaching, and the UI reports failure instead of inventing success. Local loopback preview only; no public hosting was authorized or performed.
