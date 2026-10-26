# Workspace Foundation Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task by task after user approval. This is a delivery-level plan: exact implementation code and dependency pins must be added during the milestone's technical review before execution. Delegation requires explicit user approval.

**Goal:** Let a user open an existing Astro project in VS Code, inspect its status, and start or stop its development preview.

**Architecture:** A TypeScript extension registers workspace and preview commands. Project discovery is read-only; a separate process controller owns dev-server execution. A small typed webview shows status and actions, while the first preview opens through VS Code browser facilities.

**Tech Stack:** Proposed TypeScript, VS Code Extension API, esbuild, Node child_process, Vitest for pure modules, and @vscode/test-electron for extension integration.

## Global Constraints

- Scope is a local desktop VS Code workspace, verified first on Linux.
- Select the project root explicitly when more than one workspace folder is present.
- Detect Astro from declared dependencies and report malformed metadata.
- Discovery must not evaluate project configuration or execute package scripts.
- Respect VS Code workspace trust before running project commands.
- Use argument arrays and process APIs, not interpolated shell command strings.
- Track and stop only processes owned by the extension.
- Do not commit, push, install dependencies, or start development work until instructed.
- This plan is proposed, not an implementation-complete claim.

## Proposed file structure

```text
package.json                         Extension metadata, commands, scripts, engine range
package-lock.json                    Locked extension dependencies
tsconfig.json                        Extension type-check configuration
esbuild.mjs                          Extension and webview build entry points
.vscode/launch.json                  Extension Development Host configuration
.vscode/tasks.json                   Debug build task
src/extension.ts                     Activation, command registration, disposal
src/workspace/project-types.ts       Shared project metadata types
src/workspace/discover-project.ts    Pure metadata parsing and Astro detection
src/workspace/select-project.ts      VS Code root-selection integration
src/preview/dev-server.ts            Owned dev-server lifecycle
src/preview/preview-url.ts           Local URL parsing and validation
src/panel/messages.ts                Validated webview message types
src/panel/studio-panel.ts            Panel lifecycle and host message handling
webview/main.tsx                     Project status and start/stop UI
webview/styles.css                   Panel styling using VS Code theme variables
tests/unit/discover-project.test.ts  Metadata fixtures and detection cases
tests/unit/preview-url.test.ts       URL parsing and rejection cases
tests/integration/extension.test.ts  Commands and selected workspace behavior
tests/fixtures/astro-project/        Minimal supported Astro project
tests/fixtures/non-astro-project/    Negative project fixture
docs/development.md                  Setup, commands, debug and verification steps
```

## Task 1 — Confirm versions and create a runnable extension

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `esbuild.mjs`, `.vscode/launch.json`, `.vscode/tasks.json`, `src/extension.ts`, `docs/development.md`.

**Interface:** Register `astroStudio.open`, `astroStudio.startPreview`, and `astroStudio.stopPreview`. Activation owns a single disposable controller per selected project.

- [ ] Check current official VS Code and Astro compatibility requirements and record exact supported versions.
- [ ] Pin compatible extension dependencies and add `build`, `typecheck`, `test:unit`, and `test:integration` scripts.
- [ ] Implement activation and command registration with disposable cleanup.
- [ ] Add a local debug launch that builds before starting Extension Development Host.
- [ ] Run `npm run build` and `npm run typecheck`; require exit code 0.
- [ ] Launch with F5 and confirm the three commands are available.

**Acceptance:** The extension activates and disposes cleanly without reading or modifying target-project source files.

## Task 2 — Detect and select Astro workspaces

**Files:** `src/workspace/project-types.ts`, `src/workspace/discover-project.ts`, `src/workspace/select-project.ts`, `tests/unit/discover-project.test.ts`, fixture metadata.

**Interfaces:** `discoverProject(rootPath: string): Promise<ProjectDiscovery>` returns a discriminated result: `astro`, `not-astro`, or `invalid`. An `astro` result includes root path, package name, package manager, and discovered dev script. `selectProject(): Promise<string | undefined>` resolves the root or returns cancellation.

- [ ] Define `ProjectDiscovery` and package-manager metadata before consuming them elsewhere.
- [ ] Add fixture-based cases for dependency/devDependency Astro declarations, malformed JSON, missing package.json, missing dev script, lockfile conflicts, and paths containing spaces.
- [ ] Run targeted detection tests and confirm expected failures before implementing detection.
- [ ] Read package metadata without importing executable configuration. Prefer declared `packageManager`; diagnose conflicting lockfiles when no explicit choice exists.
- [ ] Add root selection for multi-root workspaces and an actionable no-folder message.
- [ ] Re-run detection tests, build, and type checks.

**Acceptance:** A non-Astro folder never launches a process. Ambiguous root and package-manager selection never silently choose a target.

## Task 3 — Show a validated project panel

**Files:** `src/panel/messages.ts`, `src/panel/studio-panel.ts`, `webview/main.tsx`, `webview/styles.css`, `src/extension.ts`, integration tests.

**Interfaces:** Define `WebviewRequest` variants `refreshProject`, `startPreview`, and `stopPreview`; define `HostEvent` variants for project state, preview state, and error messages. Reject unknown message types and invalid payloads in the extension host.

- [ ] Implement the message contract and host-side runtime validation.
- [ ] Add project name, root path, package manager, dev-script state, preview state, and diagnostic display.
- [ ] Use VS Code theme tokens, a restrictive content policy, and bundled local assets.
- [ ] Wire refresh to discovery; do not let the webview pass arbitrary paths or commands.
- [ ] Verify unknown messages do not execute actions.
- [ ] Run build/type checks and exercise panel open, close, reopen, and root change in Extension Development Host.

**Acceptance:** The panel shows actionable state and remains usable when project discovery fails.

## Task 4 — Own the development-server lifecycle

**Files:** `src/preview/dev-server.ts`, `src/preview/preview-url.ts`, `src/extension.ts`, `src/panel/studio-panel.ts`, URL unit tests and integration tests.

**Interfaces:** `DevServerController.start(project): Promise<void>`, `stop(): Promise<void>`, `dispose(): void`, and state events covering `stopped`, `starting`, `running`, and `failed`. Define project input using the `astro` discovery result from task 2.

- [ ] Add URL parsing tests for ANSI output, localhost/loopback addresses, invalid schemes, and unrelated output.
- [ ] Confirm that preview controls require a trusted workspace and a valid discovered dev command.
- [ ] Launch the selected package manager in the selected root with argument arrays; stream bounded logs to an output channel.
- [ ] Prevent duplicate starts and keep process ownership separate from attaching to existing servers.
- [ ] Parse the actual emitted URL; account for Astro selecting a different port when the preferred port is occupied.
- [ ] Open the validated local preview with VS Code browser facilities.
- [ ] Stop the owned process tree on explicit stop, project change, and disposal; verify no orphan remains on Linux.
- [ ] Handle immediate exits, missing package managers, failed scripts, and cancellation during startup.

**Acceptance:** Start/stop works repeatedly. Port collisions do not open the wrong site. Closing the extension does not leave an owned dev server running.

## Task 5 — Verify and record the first working milestone

**Files:** `tests/integration/extension.test.ts`, fixture project files, `docs/development.md`, vault progress note.

- [ ] Run `npm run build`, `npm run typecheck`, `npm run test:unit`, and `npm run test:integration`; require exit code 0.
- [ ] Manually verify a real Astro project in Extension Development Host.
- [ ] Verify no-folder, non-Astro, malformed metadata, untrusted workspace, multi-root workspace, paths containing spaces, failed dev script, occupied port, and stop/restart behavior.
- [ ] Record commands, results, tested tool versions, and any platform limits in `docs/development.md`.
- [ ] Demonstrate the working extension to the user and obtain milestone acceptance.
- [ ] Update the vault progress checklist only for behavior actually verified.

**Acceptance:** Milestone 1 is a usable workspace/preview extension, not a CMS placeholder presented as a finished product.

## Technical review before execution

This document deliberately does not pretend that dependency versions, provider APIs, or Astro internals were researched during documentation setup. Before executing, pin the versions, expand implementation steps with exact code and concrete test bodies, then re-review file paths and interface consistency. Milestones 2–9 each require their own detailed plan at the appropriate checkpoint.
