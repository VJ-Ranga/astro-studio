# Development

## Current implementation

The ten-day MVP engineering scope is implemented: local project discovery, owned Astro preview, supported content forms, proactive conflict/save observation, native Git review, and an installable Linux VSIX. Human acceptance remains a user review checkpoint. See [MVP acceptance](mvp-acceptance.md) for the final artifact and evidence.

The commands currently behave as follows:

- **Astro Studio: Open Studio** opens or reveals one Studio panel and inspects the selected project. A single-root local workspace selects automatically; multi-root workspaces require an explicit Quick Pick choice. Use the panel's **Select project** and **Refresh project** buttons to change selection or reload metadata.
- **Astro Studio: Start Preview** requires workspace trust, refreshes discovery, and runs the selected package manager with `run dev` in the selected project root. It detects the emitted Local URL and opens the native browser. Repeated starts do not create another server.
- **Astro Studio: Stop Preview** cancels pending startup or stops the process group owned by Studio. The panel shows Stopping until cleanup is confirmed. If cleanup fails, Start remains disabled and Stop can retry. External dev servers are not stopped.

Discovery reads `package.json` and root lockfile names without executing project code. Starting preview is a separate explicit action that executes the project's normal dev script and configuration. Target-project dependencies must already be installed; Studio does not install them. Astro may create its usual development cache files when it runs.

The panel displays the selected root, package name, declared Astro version, package manager and detection source, dev script, trust state, preview state, actual local URL, and actionable diagnostics. Missing folders, malformed metadata, non-Astro roots, missing dev scripts, and conflicting lockfiles have explicit states. A valid `packageManager` declaration takes precedence; conflicting inferred managers remain unresolved. With no declaration or lockfiles, the panel explicitly reports its npm fallback.

Read-only metadata discovery remains available in Restricted Mode; preview execution does not. Removed roots invalidate selection and initiate owned-preview cleanup. Selecting a different root waits for the previous preview to stop and rechecks that the selected root still exists. Sequence guards prevent late discovery responses from overwriting newer results or launching after Stop. Closing the panel does not stop a preview; subscription disposal initiates cleanup immediately, and extension deactivation awaits its completion. Reopening the panel shows the current preview state.

The **Local content** section lists nested saved `.md`/`.mdx` entries from `src/content/`. Select a file to inspect its fields and diagnostics; use **Open source** to open its canonical local path. **Edit fields** loads the current editor buffer. **Apply to editor** performs one undoable native edit without saving. Select the opened source editor and save normally to update the actual site. **Refresh content** reloads saved-file state. See [content support](content-support.md) for the exact YAML subset, session/version behavior, and filesystem limits.

## Tested development baseline

Verified on Linux x64 during 2026-10-25–26:

| Tool | Version | Scope |
| --- | --- | --- |
| Node.js | 22.23.1 | Local build and test tooling |
| npm | 10.9.8 | Dependency installation and lockfile |
| VS Code | 1.143.1 | Real Extension Development Host smoke test |
| VS Code API types | 1.140.0 | Compile-time definitions; runtime engine floor is the tested VS Code 1.143.1 |
| Node.js API types | 22.20.5 | Extension type checking |
| TypeScript | 5.9.3 | Type checking |
| esbuild | 0.28.2 | CommonJS bundling and source maps |
| Vitest | 5.0.5 | Discovery, selection, protocol, lifecycle, and rendering tests |
| `@vscode/test-electron` | 3.1.0 | Extension integration launcher |
| React / React DOM | 19.3.1 | Bundled project-status webview |
| React / React DOM API types | 19.3.0 | Webview type checking |
| Astro | 7.4.2 | Runnable preview fixture, including occupied-port verification |
| Project-local Node.js | 22.23.4 | Runnable fixture only; global Node.js remains 22.23.1 |
| YAML | 2.9.1 | Frontmatter syntax-node analysis and bounded scalar-edit source ranges |
| `@vscode/vsce` | 3.9.2 | Linux VSIX packaging; compatible audited identity/UUID overrides are locked |

All direct dependencies use exact versions. `package-lock.json` locks extension dependencies. React is bundled for the browser only; Astro is not an extension dependency. The Day 2 metadata fixture deliberately has no Astro installation. A separate `tests/fixtures/preview site/` project contains the runnable Astro dependency, local Node.js binary, and its own lockfile.

### Astro compatibility checkpoint

The [official Astro installation guide](https://docs.astro.build/en/install-and-setup/) and `npm view astro@7.4.2 engines` report Node.js **>=22.23.4** for Astro **7.4.2**. The global Node.js **22.23.1** is below that requirement. Day 3 resolved the fixture prerequisite by pinning project-local `node@22.23.4`; npm prepends the fixture's `.bin` directory when it runs the dev script.

The initial fixture installation under global Node.js emitted engine warnings, then installed the local runtime successfully. `./node_modules/.bin/node --version` inside the fixture reported `v22.23.4`. Real Astro startup and HTTP responses were verified with that runtime. No global Node.js installation was changed. Other target projects still need their own compatible runtime and installed dependencies.

VS Code's [manifest reference](https://code.visualstudio.com/api/references/extension-manifest) defines the editor engine requirement and contributed commands. Commands contributed by extensions targeting modern VS Code activate automatically; no eager startup activation event is needed. The [extension testing guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension) documents the real Extension Development Host used here.

## Setup

Open this project folder and run:

```bash
npm ci
npm run build
npm run typecheck
npm run test:unit
```

Run **Astro Studio: Extension Development Host** from VS Code's Run and Debug view, or press F5. The launch configuration runs the build task first. In the new window, open the Command Palette and execute the three Astro Studio commands listed above.

`npm run watch` rebuilds host and browser assets on source changes. Reload the Extension Development Host to load updated extension code. The built extension is `dist/extension.cjs`; browser assets are under `dist/webview/`. `vscode` remains external and is provided by the editor.

## Extension-host integration test

With a graphical display available:

```bash
npm run test:integration
```

By default, `@vscode/test-electron` downloads VS Code 1.143.1 into its local ignored cache. To use an installed **editor executable**, not the shell CLI wrapper:

```bash
VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration
```

The installed-executable command above is the path verified on this machine. The automatic download path has not been exercised. Overrides should use VS Code 1.143.1 to reproduce the tested baseline; the smoke test prints the actual runtime version.

The runner launches three isolated editor sessions: no folder, the Day 2 metadata fixture, then the runnable preview fixture. Each session uses temporary user-data and extension directories, removed afterward. Tests verify activation, project state, panel reuse/close/reopen, and unchanged package metadata. The live fixture additionally verifies real Start/Stop, an HTTP response, duplicate rejection, the native browser, restart, and the real loaded extension module's awaited deactivation hook. Install the preview fixture dependencies before running the full integration suite. UI assertions use bounded condition polling because editor tab events propagate asynchronously.

On headless Linux with Xvfb installed:

```bash
xvfb-run -a npm run test:integration
```

The runner fails with an actionable message if neither `DISPLAY` nor `WAYLAND_DISPLAY` is available. A skipped or failed graphical run is not a passing activation test.

## Day 1 verification evidence

Executed on 2026-10-25:

| Command | Result |
| --- | --- |
| `npm install` | Exit 0; 79 packages added, audit reported 0 vulnerabilities |
| `npm run test:unit` before implementation | Three assertions failed because no commands or disposable subscription existed |
| `npm run test:unit` after implementation | Exit 0; 3 tests passed |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0; extension and integration bundles plus source maps generated |
| `VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration` | Exit 0; command-driven activation and all 3 commands passed in VS Code 1.143.1 |
| `npm ls --depth=0` | Exit 0; all six exact direct development dependencies resolved |

The installed editor emitted unrelated bundled-agent/API-proposal diagnostics during startup. The extension smoke test still completed with its explicit PASS line and editor exit code 0. No extension activation failure was reported.

Day 1's unit tests isolated the VS Code host API to verify command ownership, honest command messages, idempotent disposal, and reactivation. Day 2 extends that coverage to project discovery and the panel lifecycle. Real editor integration remains separate from host-API isolation.

## Day 2 verification evidence

Executed on 2026-10-25:

| Check | Result |
| --- | --- |
| Discovery/selection tests before implementation | Failed for missing Astro detection, diagnostics, and root selection |
| Protocol and panel tests before implementation | Failed for missing accepted requests, panel creation, and project state |
| React rendering tests before implementation | Four failed for missing empty/error/metadata content |
| Mixed local/virtual multi-root regression | Failed before fixing silent single-local-root selection; passed afterward |
| `npm run test:unit` | Exit 0; 56 tests across 5 files passed |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0; extension, integration, React, and CSS bundles generated |
| `npm ls --depth=0` | Exit 0; all ten exact direct dependencies resolved |
| `VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration` | Exit 0; both no-folder and Astro metadata-fixture sessions passed on VS Code 1.143.1 |
| Browser harness, `tests/browser/panel-smoke.cjs` | Passed ready handshake, select/refresh requests, empty/restricted state, metadata/diagnostics, 360px layout, hostile-text escaping, and no browser exceptions |

Filesystem fixtures cover missing and malformed JSON, invalid metadata shapes, declarations in dependencies/devDependencies, unsupported package managers, missing dev scripts, conflicting and redundant lockfiles, oversized metadata, and space-containing paths. Host-boundary tests cover explicit multi-root selection, cancellation, root removal during a read, stale responses, and idempotent disposal.

Both real editor sessions reported `trusted=true`; Restricted Mode rendering and host state were exercised by unit/browser tests, not a real restricted editor session. Real multi-root Quick Pick interaction is covered at the host boundary, not by editor UI automation.

### Browser harness

After `npm run build`, start the local test-only harness:

```bash
node tests/browser/serve.mjs
```

It binds to `127.0.0.1:4372` and serves only the test HTML shell and two built browser assets. Run `tests/browser/panel-smoke.cjs` through the browser tool's `run_code` filename entry point. The harness supplies a fake VS Code messaging bridge; the separate editor tests exercise the actual extension host. Stop the harness with Ctrl+C when finished. The verification session's harness process was stopped after testing.

The production panel uses a nonce-restricted script policy, bundled local CSS, no network connections, and local resource roots limited to its asset directory. Project text travels in messages and renders as escaped React text. Webview requests reject unknown actions, wrong protocol versions, extra fields, arbitrary paths, and command payloads.

## Remaining release work

Days 1–10 engineering checks are complete. External-change/save observation, native Git handoff, packaging, and clean-profile verification are included. Later product milestones cover component drag-and-drop, agents, media, and deployment; they are not part of version 0.1.0.

VSIX packaging and `npm run package` are scheduled for Day 8. CMS, agent adapters, and deployment remain later work. Linux desktop with npm is the verified preview runtime; pnpm/yarn/bun use their standard `run dev` invocation but have not received live-provider verification. Windows preview spawning is explicitly unsupported in this build.

## Day 3 preview setup and behavior

Install the standalone fixture and run its occupied-port acceptance check from the extension root:

```bash
npm --prefix "tests/fixtures/preview site" ci
ASTRO_TELEMETRY_DISABLED=1 npm run test:preview
```

The acceptance check occupies `127.0.0.1:45321`, starts real Astro through `DevServerController`, fetches the actual emitted alternate URL, verifies duplicate rejection, and stops its processes in cleanup. The fixture deliberately uses a path containing spaces. Its normal preferred port is 45321.

To try the extension, press F5, open `tests/fixtures/preview site/` in the development window, and run **Astro Studio: Open Studio**, then **Start preview**. Use **Open preview** to reopen the current host-owned URL, **Show preview logs** for the output channel, or **Stop preview** to terminate the owned server.

Startup uses `spawn(manager, ['run', 'dev'], { cwd, shell: false, detached: true })`; it does not interpolate the dev script into a shell command. Normal package-manager script behavior still applies. Workspace trust is checked before and after asynchronous discovery, and the server controller independently checks trust and metadata prerequisites.

Only a labelled Local HTTP(S) endpoint with host `localhost`, `127.0.0.1`, or `[::1]` is accepted. ANSI output and split chunks are handled; stdout/stderr buffers are separate. Network links, unrelated URLs, credentials, queries, fragments, and invalid schemes are rejected. A 30-second startup timeout produces an actionable failed state rather than opening a guessed URL.

The retained tail is at most 100 lines and 16,384 characters. Individual lines and partial-line buffers are bounded. The output channel is replaced with that tail; the panel receives the same bounded logs. States are stopped, starting, running, stopping, and failed. Failed cleanup additionally retains `cleanupPending` ownership so a new server cannot overlap it.

The browser helper calls `simpleBrowser.show` with the validated actual URL. In VS Code 1.143.1 this command delegates to the newer integrated browser, whose tab label is the endpoint host/port rather than "Simple Browser". If the command is unavailable, the helper falls back to `vscode.env.openExternal`. The webview cannot supply a URL or command payload.

## Day 3 verification evidence

Executed on 2026-10-25:

| Check | Result |
| --- | --- |
| Fixture `npm install` | Exit 0; 194 packages installed, audit reported 0 vulnerabilities; bootstrap engine warnings noted above |
| Fixture local runtime | `v22.23.4` |
| URL/controller tests before implementation | Failed for missing local URL detection, startup states, trust gates, and process behavior |
| Host/browser-helper/UI tests before implementation | Failed for missing preview launch, browser invocation, fixed actions, and running-state rendering |
| `npm run test:unit` | Exit 0; 89 tests across 8 files passed |
| `npm run typecheck` | Exit 0 |
| `ASTRO_TELEMETRY_DISABLED=1 npm run test:preview` | Exit 0; real Astro 7.4.2 selected `http://127.0.0.1:45322/` while 45321 was occupied, served the fixture, rejected duplicate starts, and stopped |
| `ASTRO_TELEMETRY_DISABLED=1 VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration` | Exit 0; all three VS Code 1.143.1 sessions passed; live preview opened the native browser at `http://127.0.0.1:45321/` and stopped afterward |
| Browser harness | Passed start/open/logs/stop requests, running-state rendering, disabled duplicate Start, existing discovery cases, hostile-text escaping, 360px layout, and no browser exceptions |

An initial integration assertion expected a tab literally named "Simple Browser". Inspection of VS Code's browser implementation confirmed delegation to the integrated browser. The assertion now accepts the actual endpoint or page-title tab, and the live test passed. Production browser invocation did not need changing.

Real npm scripts also verified split ANSI output, separate stdout/stderr, log retention, startup failure exit code, timeout, and an unreachable endpoint after Stop. Host tests verified that untrusted workspaces and a trust change during discovery cannot launch a process, and that Stop cancels startup pending discovery. `@vscode/test-electron` automatically adds `--disable-workspace-trust`; real editor sessions are therefore trusted, with the restricted path verified at the host/controller/browser boundaries.

## Day 4 lifecycle and recovery

Process ownership now lives in `src/preview/owned-process.ts`, separate from dev-server output and readiness. Stop sends SIGTERM to the detached owned process group immediately. If live members remain after 1.5 seconds, cleanup escalates to SIGKILL and allows a further 2 seconds for confirmation. Linux `/proc` process-group/state checks distinguish live workers from zombies; cleanup also waits for inherited output pipes to close. The verified target requires ordinary readable Linux `/proc` process metadata.

The package-manager leader's exit no longer proves that its workers have stopped. Unexpected exit initiates failure cleanup immediately, even if a worker holds pipes open. Ownership is released only after cleanup confirmation. A signalling or confirmation error leaves an actionable failed state with ownership retained; Stop can retry, and Start cannot replace the old group.

`DevServerController.dispose()` and the extension's deactivation hook return shared completion promises. Concurrent calls await the same cleanup. VS Code subscription disposal starts cleanup without waiting; the deactivation hook awaits that same operation, and callbacks do not write to disposed UI resources. Cleanup failures are observed and propagated through the awaited shutdown hook.

The supported project script runs a foreground dev server in the process group Studio launched. Intentionally daemonized processes that create a separate session are outside that ownership model. Studio never finds or kills a process by guessing a port.

### Verified failure and recovery cases

- A worker that ignores SIGTERM and redirects output is killed even after its leader closes.
- A leader that exits while a stubborn worker holds pipes open triggers failure cleanup rather than remaining Running indefinitely.
- Stop immediately clears the old URL, reports Stopping, and blocks restart until cleanup completes.
- A missing npm executable reports failure, then succeeds after PATH is restored.
- A repaired failing script restarts with new logs and no stale error message.
- Repeated start/stop and cancellation during startup settle without a stale URL.
- An injected SIGTERM permission error retains ownership; Start is blocked and a later Stop retry succeeds.
- Selected-root removal during cleanup cannot assign a stale root. Incomplete cleanup prevents switching to a replacement root.
- Real Astro restart and disposal leave its previous HTTP endpoint unreachable while an unrelated listener remains available.

Root selection/removal races and Restricted Mode are verified at the host/controller boundary. The real VS Code test verifies the loaded module's actual deactivation hook while Astro is running; it does not force-kill the editor process or automate a multi-root Quick Pick.

### Day 4 verification evidence

Executed on 2026-10-25:

| Check | Result |
| --- | --- |
| Process regressions against Day 3 | Five failures reproduced: surviving descendant, hidden leader exit, missing Stopping state, early disposal return, and missing-executable retry |
| Host/UI regressions before fixes | Reproduced unawaited deactivation, stale root assignment, switching despite incomplete cleanup, and missing Stopping label |
| Concurrent deactivation regression | Reproduced a second caller returning before the first cleanup completed; fixed with a shared shutdown promise |
| `npm run test:unit` | Exit 0; 102 tests across 8 files passed |
| `npm run typecheck` | Exit 0 |
| `ASTRO_TELEMETRY_DISABLED=1 npm run test:preview` | Exit 0; Astro 7.4.2 selected port 45322 with 45321 occupied, completed 3 start/stop cycles plus awaited disposal, and preserved the unrelated listener |
| `ASTRO_TELEMETRY_DISABLED=1 VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration` | Exit 0; all 3 VS Code 1.143.1 sessions passed, including live Stop, restart, native browser, and awaited deactivation |
| Browser harness | Passed stopping guards, hidden Open action during cleanup, disabled Start while cleanup is incomplete, enabled Stop retry, existing discovery/preview cases, 360px layout, and no browser exceptions |

The test harness process was stopped after browser verification. Real subprocess regression teardown also records and removes its own fixture workers so a failing regression cannot leave its intentionally stubborn test server running.

## Day 5 and Week 1 verification

The browser uses `yaml@2.9.1` syntax nodes, never executable configuration, alias expansion, or YAML serialization. Existing title/description strings and draft booleans are inspected with source ranges. Unsupported YAML and MDX remain source-only; unknown fields and the Markdown body are not rewritten. Field inspection is limited to 4096 characters per string.

Canonical path checks reject escaping roots and symlinks. Directory symlinks and special files are skipped. Scans are bounded to 200 entries, 500 directories, depth 12, 1 MiB per file, and 40 scan diagnostics. Open Source uses an opaque current-scan ID and rechecks containment. Changing the project or disposing the controller invalidates older scans and IDs.

The runnable fixture contains seven content examples: supported frontmatter with unknown nested data, nested Unicode content, aliases, duplicate keys, multiline scalars, body-only Markdown, and MDX. Unit filesystem fixtures additionally exercise CRLF, BOM, symlinks, oversized files, FIFOs, depth limits, and entry-count truncation.

Executed on 2026-10-25:

| Check | Result |
| --- | --- |
| Parser/scanner tests before implementation | 26 failures reproduced for missing supported fields, diagnostics, listing, containment, and bounds |
| Controller/protocol tests before implementation | 7 failures reproduced for missing current-scan authorization, stale-scan handling, and fixed content actions |
| Content rendering tests before implementation | 3 failures reproduced for missing empty/list/detail states |
| `npm install --save-exact yaml@2.9.1` | Exit 0; audit reported 0 vulnerabilities |
| `npm run test:unit` | Exit 0; 142 tests across 12 files passed |
| `npm run typecheck` | Exit 0 |
| `ASTRO_TELEMETRY_DISABLED=1 npm run test:preview` | Exit 0; actual Astro occupied-port, restart, cleanup, and unrelated-listener checks passed with the new content fixtures present |
| `ASTRO_TELEMETRY_DISABLED=1 VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration` | Exit 0; all three editor sessions passed, including seven-entry content discovery, native source opening, identical saved bytes, dirty-buffer preservation, preview, restart, and awaited shutdown |
| Browser harness | Content selection, supported/source-only details, exact opaque Open Source requests, refresh, no editable form controls, 360px layout, and existing preview/discovery checks passed without browser exceptions |
| `npm ls --depth=0` | Exit 0; all 11 direct dependencies resolved at exact versions |

The stale-refresh unit test was updated to wait until its first metadata read begins before starting the competing refresh. Adding content invalidation introduced an asynchronous boundary; condition-based scheduling preserves the test's intended race rather than relying on synchronous call order.

See [Week 1 acceptance record](week-one-acceptance.md) for the delivered workflow, demonstration, limitations, and remaining Week 2 plan. User review is pending; engineering verification is complete.

## Day 6 source-preserving forms

The user authorized Day 6 after the Week 1 YAML-contract handoff. Only existing supported `title`, `description`, and `draft` fields are editable. The planner validates typed values, replaces their scalar source spans, and reparses the result. It does not round-trip the full YAML document, touch unknown fields/body text, create missing fields, or edit MDX/source-only documents.

The document coordinator reads native buffers rather than saved metadata, generates opaque form tokens, and retains the document version/fingerprint in the host. Apply revalidates the canonical entry, checks the version after opening/showing the editor, and sends one version-bound `TextEditor.edit` with undo stops before and after. No automatic save is called. Conflict/error updates preserve the current local draft; Reload fields explicitly discards it. Inspecting another entry and returning keeps the same active draft.

The native source editor opens beside Studio while preserving form focus. Select that source editor before using Save or Undo. Dirty indicators are form snapshots until reload/apply; full editor/save/external-file observation remains Day 7.

The runnable fixture now has a normal Astro `posts` collection and renders the welcome entry's title. Discovery still never evaluates this configuration. The root TypeScript project excludes standalone fixtures because their `astro:content` virtual types belong to Astro; the collection is exercised by the real Astro runtime rather than counted as an independent Astro semantic type check.

### Day 6 verification evidence

Executed on 2026-10-26:

| Check | Result |
| --- | --- |
| Scalar planner before implementation | 13 failures reproduced for missing replacements, source-only refusal, invalid/missing fields, and escaping/preservation |
| Document coordinator before implementation | 7 failures reproduced for missing current-buffer loads, edits, session expiry, version checks, and authorization |
| Form/protocol tests before implementation | 3 missing-form rendering failures and 1 typed-submission validation failure reproduced |
| `npm run test:unit` | Exit 0; 169 tests across 15 files passed |
| Targeted document/form tests after copy/label fixes | Exit 0; 12 tests passed |
| `npm run typecheck` and `npm run build` | Exit 0 |
| `ASTRO_TELEMETRY_DISABLED=1 npm run test:preview` | Exit 0; real Astro occupied-port, repeated start/stop, awaited cleanup, and unrelated-listener checks passed with the collection fixture |
| `ASTRO_TELEMETRY_DISABLED=1 VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration` | Exit 0; all 3 editor sessions passed, including native form apply, one-step undo, dirty-buffer load, stale-version refusal, unsupported-source refusal, explicit Save, live Astro title update, and restoration of original fixture bytes |
| Browser harness | Passed typed form payloads, Title/Draft controls, preserved drafts on conflict and entry inspection, explicit reload, 360px form layout, and prior content/preview checks without browser exceptions |

Pure fixtures verify BOM, CRLF/LF, Unicode, inline comments, unknown nested fields, body fidelity, unchanged quote spelling, escaped newlines, booleans, and rejection of unsupported YAML/types. Coordinator tests verify repeated version checks, source fingerprints, native edit rejection, duplicate submission guards, expired sessions, current entry authorization, and no automatic save.

The browser initially found that a label wrapping a textarea included its initial text in label-text matching. Labels are now separate, explicitly associated elements; browser field lookup and form interaction pass. All temporary browser/server processes were stopped after verification.

## Days 7–10 completion and release checks

`ContentObserver` scopes document/save and filesystem observation to the selected content root. Saved-file checks and list refreshes are debounced/coalesced. Same-root refresh keeps entries authorized while scanning and replays updates arriving during initial discovery. Source changes update conflict/dirty state while preserving form tokens and draft values. A reported external conflict must be explicitly reloaded even if the editor's dirty buffer has not reloaded the saved file yet.

Native Git handoff activates VS Code's built-in Git API, finds the most specific repository, and opens Source Control or `git.openChange` for a currently authorized file. Missing repositories are explained without automatic initialization. A temporary repository with a tracked changed file verifies the actual native diff editor.

The release manifest uses an explicit file allowlist. `npm run package` builds production bundles and creates `artifacts/astro-studio-0.1.0-linux-x64.vsix`. `npm run test:package` checks archive membership, version/engine metadata, byte equality with current runtime assets/notices/user guide, and a SHA-256 sidecar. README/changelog case normalization by vsce is accounted for explicitly. The existing UNLICENSED status is retained; bundled MIT/ISC notices are shipped.

`npm run test:installed` installs the exact archive into an isolated extensions directory. A separate disposable driver and complete copied Astro fixture execute from a temporary working directory, so the installed runtime cannot resolve development-checkout dependencies accidentally. It runs the supported source/form/preview workflow, then launches another clean profile directly to verify actual Restricted Mode. The direct restricted launch is necessary because `@vscode/test-electron` normally adds `--disable-workspace-trust`.

The packaging tool is pinned to vsce 3.9.2 with `@azure/identity` 4.13.0 and UUID 11.1.1 overrides after current audit advisories affected newer/older dependency combinations. Actual packaging passes and the final audit reports zero vulnerabilities; these tooling dependencies are excluded from the shipped bundle.

Final local evidence on 2026-10-26:

- 180 tests across 17 files passed.
- Type checks, production build, dependency audit, actual Astro lifecycle, and the fixture's static build passed.
- Four development editor scenarios passed, including a disposable real Git diff workflow.
- The 0.1.0 VSIX allowlist contains 10 files and its current runtime assets match the verified build.
- The installed VSIX passed native apply/undo, external-save refresh, conflict retention, explicit Save/live title update, restart/deactivation, and actual Restricted Mode.
- Browser checks passed source/diff actions, forms, draft retention/reload, preview controls, escaping, and narrow layout.

The final installed suite initially exposed an immediate Undo assertion racing extension-host document propagation. The assertion now waits for the observed buffer text with a deadline; it still issues exactly one Undo. The candidate recheck passed. See [MVP acceptance](mvp-acceptance.md) for the checksum and installation walkthrough.

CI is defined in `.github/workflows/ci.yml` using Node.js 22.23.4, clean installs, audit/type/unit/preview/editor/build/package/installed checks, and VSIX/checksum artifact upload. The publication task verifies its run and remote tracking after pushing the reviewed source.
