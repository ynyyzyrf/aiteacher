# Pi and Mentora integration decision

Inspected 2026-10-04. The checkout at `https://github.com/ynyyzyrf/aiteacher.git` was empty (unborn `work` branch), with no prior teaching harness, AGENTS.md, or .agents/skills files. No unrelated work existed to overwrite. No commits, remote push, PR, deployment or account changes were made.

## Pi owns the teaching harness

Primary reference: https://github.com/earendil-works/pi/tree/main/packages/coding-agent
Reference checkout: `200387122ca450d6387f033949423114a270b96c`.
Installed and lockfile-pinned: `@earendil-works/pi-coding-agent@1.0.2` (plus pi-ai and pi-agent-core 1.0.2). Node >=22.19.0.

Read `docs/sdk.md`, `examples/sdk/12-full-control.ts`, `examples/sdk/09-api-keys-and-oauth.ts`, and actual SDK/session/model-runtime implementations. Selected supported in-process `createAgentSession` SDK rather than RPC: this slice is already TypeScript, can typecheck tool definitions, directly awaits `abort()`, and uses in-memory `SessionManager`. RPC would add subprocess transport and extension packaging without improving this validation.

Pi owns model choice, conversation history, the agent/tool loop and cancellation. `plan_lesson` and `board_beat` are registered Pi tools, not JSON parsed from a direct model call. There is no LangChain, Mentora agent, alternate live teacher or direct provider completion path. The host owns only material ingestion, validation, presentation pacing and checkpoints. It does not prewrite the live course. Explicit SDK ResourceLoader has no extensions, skill files, prompts, project context or executable resources; only the two teaching tools are allowed. No read/bash/edit/write/browser tools. Retry, compaction and cache warming are disabled for bounded validation. The 45-second deadline and tool-call ceiling limit failed runs.

The offline fixture substitutes **only** `session.agent.streamFunction`. Real `session.prompt`, Pi session history and tool execution remain in use. It replays imported excerpts; it is deliberately not an AI teacher, and is never a fallback for live failure. All fixture UI and CLI output says so. This exercises the harness without a paid model request. Provider authentication/protocol, semantic teaching quality and model-specific tool adherence require live verification.

## Mentora: narrow utility reuse, no harness adoption

Reference: https://github.com/hamzaali81/mentora
Inspected commit: `2bb19ef4c3616a33011695e05c50eef08623b269`.
License: MIT, Copyright (c) 2026 Hamza Ali. Preserved verbatim at [MENTORA-LICENSE.txt](MENTORA-LICENSE.txt).

Inspected `apps/web/src/features/room/{WhiteboardStage.tsx,board-store.ts,rough-paths.ts,useVoice.ts}`, package manifest and README. The main canvas depends on React-Konva/Konva, the Zustand room store, `@mentora/contracts`, tool modes and the session-service frame protocol. Pulling it in would also bring assumptions about its separate concurrent teacher/board agents and anchor synchronization. Those conflict with validating a single Pi teaching harness in this small slice.

Reused just the isolated `arrowHead` geometry function from `rough-paths.ts` in `src/arrow-head.ts`, with attribution. It is exercised by the constrained SVG flow renderer. Built a minimal React/DOM/SVG whiteboard and accessible text interface instead. No Mentora teacher agent, auth, voice hook, mocks, persistence or services were copied. Its README explicitly describes deterministic default agents, opt-in Claude and services that do not connect to their database containers; no production-readiness conclusion is drawn from the docs.

## Material provenance

`samples/typescript-intro.md` is an original Traditional Chinese explanatory note, not an official translation or a fixed generated course. Reference pages inspected:
- https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html — TS is a static checker over JS; types are erased; runtime behavior is JS.
- https://www.typescriptlang.org/docs/handbook/2/everyday-types.html — primitives, variable annotations/inference and function parameter annotations.
- https://www.typescriptlang.org/docs/handbook/2/basic-types.html — early checking, erased types and noEmitOnError distinction.

The sample avoids claiming all JS is type-correct TS, that types validate network data at runtime, or that a type error always prevents JS emission. Imported user material is labeled unverified, not promoted to an authoritative source. Normalized text, SHA-256, line numbering, import time and origin remain visible in each session. Tools reject nonexistent/mismatched line references or quotes. Exact quote matching proves provenance, **not semantic entailment**; live correctness still needs human assessment against the linked source.

## UI functional revision

The follow-up introduces `@phosphor-icons/react@2.1.10` (MIT) for standard interface icons. The teacher is a static Robot icon, explicitly labeled; no reference portrait, generated avatar, live video or animation capability is implied. Home/classroom reference matching is blocked because the actual selected Library image pixels could not be accessed (proxy 403). See `../design-qa.md`. Existing MAG colors remain a functional baseline until reference access is available.
