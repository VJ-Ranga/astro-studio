# Day 2 Project Discovery and Status Panel Implementation Plan

> Execute inline with executing-plans. The user approved Day 2 execution. Do not delegate, commit, push, or execute target-project code.

**Goal:** Open a reusable Studio panel, explicitly select a local workspace root, and display read-only Astro metadata and actionable diagnostics.

**Architecture:** A filesystem discovery module returns a discriminated `ProjectDiscovery`. A VS Code root picker supplies the root; the webview cannot supply paths. One host controller owns selection, request sequencing, panel lifetime, and subscriptions. React receives typed state through a version-1 message protocol.

**Tech stack:** Existing locked TypeScript/esbuild/VS Code tooling; React and React DOM 19.3.1 with API types 19.3.0. Bundle browser assets locally. Use no remote fonts, assets, database, runtime config imports, or shell processes.

## Scope and decisions

- Follow the approved extension-host/React-webview approach. A native tree view offers less form flexibility; a separate browser service adds unnecessary lifecycle work.
- Detect Astro only from a nonempty string in `dependencies.astro` or `devDependencies.astro`. Missing/malformed metadata produces an invalid result; valid non-Astro metadata produces `not-astro`.
- Prefer a supported `packageManager` declaration (`npm`, `pnpm`, `yarn`, `bun`). Otherwise infer from root lockfiles. Multiple managers produce a diagnostic and a null manager, never a silent choice. With no declaration or lockfile, explicitly report an npm fallback.
- Read `scripts.dev` as text only. Missing/invalid scripts produce a diagnostic. Read no executable Astro configuration, load no project module, and start no process.
- A single-root local workspace selects automatically; multiple workspace folders require a Quick Pick, even when only one is local. Virtual roots are not selectable. Cancellation preserves an existing selection. Workspace changes invalidate removed selections and prevent stale reads from repopulating the panel.
- Show no-folder, selection-required, loading, Astro, non-Astro, and invalid states. Include trust, root, package name, Astro declaration, package manager/source, dev script, diagnostics, and an honest unavailable-preview status.
- Protocol requests are exactly `{version: 1, type}` with types `ready`, `refreshProject`, `selectProject`, `startPreview`, and `stopPreview`. Reject extra keys, unknown types, malformed messages, and wrong versions.
- Host events are `{version: 1, type: 'state', state: StudioState}`. A ready handshake sends the current state after the browser listener attaches; hidden-panel reloads use the same handshake.
- Reuse one panel; dispose its listeners when closed and recreate safely. Sequence discovery requests so late results cannot overwrite a newer selection or a disposed controller.

## Visual design

The panel is a project inspection instrument for Astro developers, not a marketing page. Use VS Code's body and editor fonts, theme colors, compact buttons, visible focus, and responsive stacked metadata rows. A single left-hand status rail distinguishes discovery states; a monospaced root path anchors the selected project. Keep preview controls visibly unavailable until the preview milestone. Avoid animation and remote assets.

## Files and task boundaries

### Task 1 — Read-only metadata discovery and root selection

Create `src/workspace/project-types.ts`, `src/workspace/discover-project.ts`, `src/workspace/select-project.ts`, `tests/unit/discover-project.test.ts`, and `tests/unit/select-project.test.ts`.

Interfaces: `discoverProject(rootPath: string): Promise<ProjectDiscovery>`; `selectProject(): Promise<string | undefined>`. `ProjectDiscovery` contains `kind`, `rootPath`, and diagnostics; Astro results add `name`, `astroVersion`, `packageManager`, `packageManagerSource`, and `devScript`.

- [x] Write fixture-based tests using temporary directories, including spaces, missing/malformed JSON, devDependencies, non-Astro metadata, missing dev scripts, and conflicting lockfiles.
- [x] Verify expected test failures before implementing discovery.
- [x] Implement bounded metadata reads and lockfile presence checks only.
- [x] Verify no-folder, single-root, multi-root choice, cancellation, and non-file roots through the picker boundary.

### Task 2 — Validated status panel

Create `src/panel/messages.ts`, `src/panel/panel-html.ts`, `src/panel/studio-panel.ts`, `webview/main.tsx`, `webview/studio-view.tsx`, `webview/styles.css`, and panel/protocol unit tests. Update `src/extension.ts`, `esbuild.mjs`, and `tsconfig.json`.

- [x] Write protocol rejection and controller lifecycle tests before implementation.
- [x] Build the React assets with browser targeting, production React, and local CSS.
- [x] Render a fixed HTML shell with a random script nonce and `default-src 'none'`; restrict local resources to the bundled webview directory. Never inject project metadata into HTML.
- [x] Handle ready, refresh, and selection in the host; keep preview command responses explicit and process-free.
- [x] Verify panel reuse, close/reopen, root removal, cancellation, and stale-result handling.
- [x] Verify rendered empty/error/success states and hostile metadata escaping.

### Task 3 — Verification and delivery evidence

Update `tests/integration/index.ts`, `scripts/test-integration.mjs`, `docs/development.md`, `README.md`, and the two-week delivery checklist.

- [x] Run `npm run build`, `npm run typecheck`, and `npm run test:unit` with exit code 0.
- [x] Run the real Extension Development Host tests against VS Code 1.143.1. Exercise no-folder activation, local discovery fixtures, and panel close/reopen.
- [x] Exercise the bundled React panel in a browser harness, including the ready handshake, selection/refresh requests, rendered diagnostics, and narrow layout.
- [x] Record exact commands, results, dependency versions, and remaining limitations. Mark only verified Day 2 behavior complete.

No Astro fixture runtime is needed for Day 2. The previously recorded Astro/Node prerequisite still applies before preview execution.
