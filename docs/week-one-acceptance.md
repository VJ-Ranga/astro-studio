# Week 1 Acceptance Record

Date: 2026-10-25
Status: Days 1–5 implemented and engineering verification complete; user review pending.

## Delivered workflow

1. Open an existing local Astro project in the Extension Development Host.
2. Open Studio and select the project root explicitly in a multi-root workspace.
3. Inspect Astro declaration, package manager, dev script, trust state, and diagnostics.
4. Start an owned preview in a trusted workspace and open its actual emitted local URL.
5. Inspect bounded logs, stop, restart, and await cleanup on extension shutdown.
6. Browse nested saved Markdown/MDX under `src/content/`.
7. Select entries, inspect supported fields or source-only diagnostics, and open source without changing file bytes or overwriting dirty buffers.

This is the first-week development build, not the completed two-week MVP. Form editing and VSIX packaging are not delivered yet.

## Acceptance checks

| Area | Evidence |
| --- | --- |
| Extension activation and project selection | VS Code 1.143.1 integration sessions plus host-boundary root-selection tests |
| Read-only metadata discovery | Valid/invalid/non-Astro fixtures, conflicting lockfiles, explicit manager choice, no executable-config imports |
| Actual site preview | Real Astro 7.4.2 HTTP response and native browser opening |
| Occupied port | Port 45321 remained occupied by an unrelated listener; Astro emitted 45322 and served the expected fixture |
| Owned cleanup and recovery | Repeated start/stop, awaited disposal, stubborn descendants, failed scripts, missing executable, cancellation, retryable signalling error |
| Content browser | Real fixture contains 7 entries, including 2 supported Markdown files and 5 source-only examples |
| Source fidelity | LF/CRLF, BOM, Unicode, comments, unknown data, source ranges, and original body fixtures; browser performs no writes |
| Path containment | Escaping content roots/file symlinks rejected, directory symlinks/special files skipped, containment rechecked before source opening |
| Source navigation | Real VS Code opens the expected file and preserves a deliberately dirty test buffer; saved bytes remain identical |
| Webview boundary | Versioned fixed actions, opaque current-scan IDs, rejection of arbitrary paths and extra payloads |
| UI | Content selection, source-only explanations, preview controls, cleanup retry, escaped text, keyboard-native buttons, and 360px layout |

Multi-root choice and Restricted Mode are covered at the host/controller/browser boundaries. The editor test harness disables Workspace Trust, so its native sessions are trusted. No Windows/macOS runtime support or arbitrary project/schema compatibility is claimed.

## Commands and actual results

```bash
npm run test:unit
npm run typecheck
ASTRO_TELEMETRY_DISABLED=1 npm run test:preview
ASTRO_TELEMETRY_DISABLED=1 VSCODE_EXECUTABLE_PATH=/usr/share/code/code npm run test:integration
npm ls --depth=0
```

- Unit tests: **142 passed across 12 files**, exit code 0.
- Type checks: exit code 0.
- Build: exit code 0, run by preview/integration verification.
- Astro acceptance: occupied-port selection, 3 start/stop cycles, awaited disposal, and unrelated-listener preservation passed.
- VS Code: all 3 isolated sessions passed. The live fixture verified content discovery, source opening, dirty-buffer preservation, unchanged bytes, actual preview, restart, and deactivation.
- Browser harness: all discovery, preview, content-selection, opaque source-open/refresh, escaping, and narrow-layout checks passed without browser exceptions. The temporary harness process was stopped afterward.
- Dependencies: all 11 direct extension dependencies resolve at exact versions, including `yaml@2.9.1`.

Runtime baseline: Linux x64, global Node.js 22.23.1, npm 10.9.8, VS Code 1.143.1, and fixture-local Node.js 22.23.4 with Astro 7.4.2. See [development guide](development.md) for dependency versions and setup.

## Demonstration

1. Open the extension project in VS Code and press F5.
2. In the development window, open `tests/fixtures/preview site/`.
3. Run **Astro Studio: Open Studio**.
4. Inspect **Local content**, select `posts/welcome.md`, and use **Open source**.
5. Select an MDX, duplicate-key, alias, or multiline example and inspect its source-only explanation.
6. Use **Start preview**, **Show preview logs**, and **Stop preview**.

The fixture dependencies must already be installed. The development guide provides the exact command.

## Scope and remaining work

The canonical [content support contract](content-support.md) defines the YAML subset. Week 1 only inspects fields; it does not save forms, create/delete entries, manage media, or visually rearrange Astro components.

Week 2 retains the existing five-working-day budget: 18 planned hours for Days 6–8 and 12 reserve/acceptance hours for Days 9–10. This remains an estimate. Day 6 adds bounded source-preserving forms; Day 7 adds dirty-buffer/conflict workflow and native Git handoff; Day 8 packages an installable VSIX. Review the YAML contract before implementing writes.

Visual drag-and-drop remains the later supported-component visual-editor milestone. Agent adapters and deployment remain in the full product roadmap.
