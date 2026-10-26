# Day 3 Preview Startup Implementation Plan

> Execute inline with executing-plans. The user approved Day 3. Do not delegate, commit, push, or change the global Node.js installation.

**Goal:** Start the selected Astro project's dev script from a trusted workspace, detect its emitted local URL, and open that URL through VS Code's native browser facilities.

**Architecture:** A VS Code-independent dev-server controller owns one process group, startup state, bounded log tail, and URL parsing. Studio revalidates discovery and workspace trust before launching. The webview sends only fixed action names; paths, commands, and URLs are host-owned.

**Tech stack:** Existing TypeScript/esbuild/React tooling and Node.js child_process APIs. A separate preview fixture pins Astro 7.4.2 and project-local Node.js 22.23.4; its npm lockfile is independent of the extension lockfile.

## Scope and interfaces

- `PreviewState`: `status` (`stopped`, `starting`, `running`, `failed`), `rootPath`, `url`, `message`, and bounded `logs`.
- `DevServerController.start(project: ProjectDiscovery | null, trusted: boolean): Promise<PreviewState>` resolves on ready/failure; duplicate starts return current state without another process. `stop(): Promise<PreviewState>` stops the owned process group; `dispose(): void` initiates cleanup. `snapshot` exposes current state.
- Spawn only a resolved supported package-manager executable with arguments `['run', 'dev']`, selected root as cwd, and `shell: false`. Do not interpolate the dev script into a shell command. Package managers execute their normal project scripts only after trust checks.
- Keep stdout/stderr line buffers separate. Strip ANSI sequences after assembling lines. Accept only the labelled `Local` HTTP(S) URL with a loopback host; ignore Network URLs, arbitrary log links, credentials, queries, fragments, and non-HTTP schemes.
- Bound line assembly and the retained log tail. Replace the output channel contents with the bounded tail rather than appending indefinitely.
- Startup timeout and process errors produce a failed state and actionable diagnostics. Basic stop/disposal and root-change cleanup are necessary now to make starting processes safe. Day 4 retains the broader lifecycle and recovery verification matrix.
- Reuse an existing owned running preview for duplicate start requests. Never attach to an external server by guessing a default port.
- Open the validated URL using `simpleBrowser.show`, falling back to `vscode.env.openExternal` if the native Simple Browser command is unavailable. A separate fixed `openPreview` action reopens the host-owned URL; `showPreviewLogs` opens the output channel. The webview never receives privileged command parameters.
- Add preview state and control availability to Studio's host event. Disable Start without trust, a selected Astro project, a resolved manager, a dev script, or while starting/running. Stop remains available during startup. Keep existing panel layout and theme tokens.

## Files and tasks

### Task 1 — Runnable fixture and URL parsing

Create `tests/fixtures/preview site/package.json`, its lockfile, `astro.config.mjs`, and `src/pages/index.astro`. Install dependencies only in that fixture. The project-local node binary supplies Astro's required runtime through npm's script PATH; no global runtime changes are needed.

Create `src/preview/preview-types.ts`, `src/preview/preview-url.ts`, and `tests/unit/preview-url.test.ts`.

- [x] Confirm Astro and Node versions, install the pinned fixture dependencies, and verify its local runtime version.
- [x] Write failing URL cases for labelled Local output, ANSI, base paths, occupied-port alternatives, IPv6, unrelated/external URLs, credentials, and invalid schemes.
- [x] Implement parsing and require passing cases.

### Task 2 — Owned server startup

Create `src/preview/dev-server.ts`, `src/preview/preview-output.ts`, and `tests/unit/dev-server.test.ts`.

- [x] Write failing tests for trust/metadata gates, real npm-script startup in a path with spaces, duplicate rejection, split output, bounded logs, process errors, and stop.
- [x] Implement tracked spawning, state notifications, timeout, bounded output, URL readiness, and minimal process-group cleanup.
- [x] Verify actual server responses through the detected URL; stop test processes in finally/afterEach cleanup.

### Task 3 — Studio commands and controls

Update `src/extension.ts`, `src/panel/messages.ts`, `webview/main.tsx`, `webview/studio-view.tsx`, `webview/styles.css`, and their unit tests. Add `webview/preview-view.tsx` to keep process UI separate from metadata UI.

- [x] Write failing host tests for trusted selection, stale selection/trust changes, fixed browser/log actions, malformed action rejection, and preview disposal.
- [x] Wire Start/Stop commands and fixed requests to the controller, rechecking discovery before execution.
- [x] Render live states, actionable errors, host-owned URL, controls, and a bounded log tail.
- [x] Preserve source-only discovery and existing panel behavior.

### Task 4 — Real fixture and editor/browser verification

Create `tests/preview/astro-preview.ts` and bundle it as a standalone verification entry point. Extend integration tests and browser smoke coverage.

- [x] Run build, type checks, and unit tests.
- [x] Occupy the fixture's preferred port, start actual Astro with the controller, fetch the emitted alternative URL, verify duplicate start behavior, and stop all owned test processes.
- [x] Exercise preview command state, native browser command registration, and no-folder handling in VS Code 1.143.1.
- [x] Exercise preview controls and state rendering in the browser harness.
- [x] Record actual evidence, runtime setup, and Day 4 follow-ups; mark only verified work complete.
