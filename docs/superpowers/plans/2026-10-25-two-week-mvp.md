# Astro Studio — Two-Week MVP Delivery Proposal

Date: 2026-10-25
Status: Days 1–10 engineering scope implemented and locally verified for preview version 0.1.0 on 2026-10-26. Source publication is authorized; human acceptance remains a user review checkpoint. See `docs/mvp-acceptance.md`.

**Goal:** Deliver an installable Linux VS Code extension that opens an existing Astro project, runs its preview, edits supported local Markdown content, and hands changes to native Source Control.

**Architecture:** Keep the proposed TypeScript extension host and React webview. The host owns project discovery, documents, validation, and preview processes. Original project files remain authoritative; native VS Code provides source editing, Git, and terminal workflows.

**Tech stack:** TypeScript, VS Code Extension API, React, esbuild, Vitest, and `@vscode/test-electron`. Confirm and pin compatible versions on Day 1; these documents contain no verified dependency pins.

**Execution:** After scope approval, expand each daily slice into its technical implementation checklist using the writing-plans skill. Execute inline with the executing-plans skill. Delegation, Git commits, pushes, and deployment require explicit user instruction.

## 1. Review of the existing plan

Reviewed:

- `docs/superpowers/specs/2026-10-25-astro-studio-design.md`
- `docs/superpowers/plans/2026-10-25-astro-studio-roadmap.md`
- `docs/superpowers/plans/2026-10-25-workspace-foundation.md`

The extension-first architecture, file ownership, bounded source edits, native Git reuse, and milestone acceptance gates are sound foundations. The roadmap is a full-product sequence, not a one-week estimate. No application code exists yet.

The main scheduling problems are:

1. Milestones 1–9 cover separate substantial systems. Arbitrary collection schemas, visual source mapping, three agent adapters, and deployment recovery cannot responsibly be treated as one week's work.
2. The foundation plan is a delivery outline. Its own technical-review section correctly requires version selection and more precise implementation steps.
3. CMS schema coverage, agent transport, server target, and rendering mode remain undecided. They are dependencies, not implementation details that can be assumed complete.
4. There is no explicit time budget, reserve, or feature-cut order.

This proposal replaces the earlier seven-day estimate with a two-week delivery track for the same focused MVP. The extra time supports implementation, review, and recovery rather than additional features. It does not replace the full product roadmap or mark its milestones complete.

## 2. Capacity and schedule

- Assume one developer working with this coding assistant, without parallel agents.
- Budget ten working days across two weeks at six focused hours per day: 60 hours total. Weekends are not required.
- Allocate 48 hours to planned slices and 12 hours to contingency, final verification, and user acceptance.
- Count Day 1 from scope approval and availability of the development environment. If Day 1 is Monday 2026-10-26, Day 10 is Friday 2026-11-06.
- This is a planning estimate, not a guarantee. Re-estimate after the Day 1 technical checks and Day 4 preview demo.
- Only Linux desktop VS Code and one pinned Astro fixture are release targets for this delivery.
- Support one selected local project root. Multiple workspace roots require explicit selection. Automatic monorepo discovery is outside this delivery.
- Target projects must already have dependencies installed. The extension reports missing prerequisites rather than installing them automatically.

## 3. Delivery choices

### A. Focused content MVP — recommended

Deliver workspace selection, owned preview, a small Markdown CMS, source editing, native Git handoff, and a locally installable VSIX. This exercises the core edit-preview-review workflow with the fewest unknown external dependencies.

### B. Agent-first demonstration

Deliver workspace selection, preview, and a shortcut launching one installed provider in the native terminal. Omit CMS forms. This demonstrates agent-assisted development but is not integrated chat or a content CMS.

### C. Broad prototype

Spread two weeks across CMS, visual editing, three agents, Git controls, and deployment. Most behavior would be shallow or unverified. Do not use this approach for a usable release.

The schedule below implements option A. Agent integration and deployment do not sit on its critical path.

## 4. Proposed two-week contract

### Included

- Open Studio, inspect project diagnostics, and explicitly select an Astro workspace.
- Detect the project's declared package manager and dev script. Diagnose ambiguity and missing executables.
- Start and stop one owned dev server, display bounded logs, and open its validated local URL through VS Code browser facilities.
- Browse local `.md` files beneath `src/content/` without evaluating Astro configuration.
- Offer a deliberately narrow form for existing top-level string fields `title` and `description`, and boolean field `draft`.
- Preserve unknown frontmatter and Markdown body text outside intended edits. Unsupported YAML constructs remain source-only.
- Open article bodies and unsupported content in VS Code's native source editor.
- Refresh content state after external saves and detect version conflicts before applying form changes.
- Provide native Source Control and file-diff handoff; Git itself remains VS Code's responsibility.
- Build and locally install a VSIX with setup instructions and tested limitations.

The content browser is a local-file browser, not a claim to discover or validate every Astro content collection. Project schema validation remains the project's responsibility; verify the fixture with its own Astro check/build commands.

### Deferred to subsequent milestones

- Runtime schema discovery, custom loaders, references, nested form fields, and remote collections.
- Entry creation, rename, delete, media upload, and rich Markdown/MDX editing.
- Visual component selection, prop editing, drag-and-drop, and preview instrumentation.
- Embedded chat, provider adapters, transcript persistence, and shared sessions.
- Custom branch/stage/commit/pull/push controls beyond native Source Control.
- Direct server deployment, deployment configuration UI, rollback, and SSR recipes.
- Windows/macOS verification, Marketplace publishing, and automatic project generation.

## 5. File responsibilities

Reuse the foundation plan's proposed workspace, preview, panel, and build structure. Add these bounded content and release units:

```text
src/content/content-types.ts          Entry summaries, editable fields, diagnostics
src/content/list-entries.ts           Recursive local Markdown discovery
src/content/frontmatter.ts            Supported-field parsing and bounded replacements
src/content/content-documents.ts      VS Code buffer versions, edits, and refresh
src/content/content-controller.ts     Selected entry and host action coordination
src/git/native-source-control.ts      Native Source Control and diff commands
webview/content-list.tsx              Entry selection and source-only badges
webview/content-form.tsx              Supported-field form and conflict display
tests/unit/list-entries.test.ts       File discovery and root containment
tests/unit/frontmatter.test.ts        Preservation and unsupported syntax fixtures
tests/integration/content.test.ts     Dirty buffers, version conflicts, external saves
tests/fixtures/astro-project/         Pinned Astro site with representative content
.vscodeignore                        Exclude development-only package files
docs/development.md                  Setup and reproducible verification commands
docs/mvp-acceptance.md                Version matrix and actual acceptance evidence
```

The existing design remains the architectural reference. Exact message schemas, supported YAML subset, parser choice, and function signatures must be approved in the content slice's technical checklist before implementation.

## 6. Two-week delivery schedule

### Week 1 — Foundation, preview, and content discovery

### Day 1 — Runnable extension and technical baseline — 6 hours

- [x] Confirm compatible Node.js, VS Code, Astro, and package versions against official documentation. Record exact tested versions.
- [x] Create extension metadata, locked dependencies, build/typecheck scripts, debug launch, and unit/integration test runners.
- [x] Register Studio, start-preview, and stop-preview commands with disposable lifecycle ownership.

**Acceptance:** Build and type checks pass. Extension Development Host activates the extension and exposes its commands. Record the exact tested dependency versions.

**Verified 2026-10-25:** Build/type checks passed, three unit tests passed, and a real VS Code 1.143.1 Extension Development Host activated the extension and executed all three foundation-only commands. See `docs/development.md` for commands and versions. Astro 7.4.2 requires Node.js >=22.23.4; the installed 22.23.1 toolchain passed Day 1 checks but needs a compatible project runtime before Astro fixture execution.

### Day 2 — Project detection and status panel — 6 hours

- [x] Implement read-only project discovery, root selection, and diagnostics without evaluating configuration.
- [x] Add the typed, validated status panel and restrictive webview content policy.
- [x] Verify missing/malformed package metadata, non-Astro folders, ambiguous lockfiles, and explicit multi-root selection.

**Acceptance:** Extension Development Host opens Studio and displays the correct selected project's status. Discovery starts no processes and changes no target files.

**Verified 2026-10-25:** Build/type checks and 56 unit tests passed. VS Code 1.143.1 sessions verified no-folder and Astro-fixture state plus panel reuse/close/reopen. Browser checks verified React metadata/error rendering, messaging, escaping, and narrow layout. Multi-root choice/cancellation and Restricted Mode state are covered by host-boundary/browser tests; real editor sessions were trusted. See `docs/development.md` and the Day 2 checklist.

### Day 3 — Preview startup and URL handling — 6 hours

- [x] Launch the selected package manager with argument arrays only in a trusted workspace.
- [x] Model stopped, starting, running, and failed states; reject duplicate starts.
- [x] Parse and validate the actual emitted local URL, including ANSI output and port changes.
- [x] Expose bounded output logs and open preview using native browser facilities.

**Acceptance:** The fixture starts and opens the actual emitted local URL, including when its preferred port is occupied. Duplicate starts are rejected and untrusted workspaces cannot run scripts.

**Verified 2026-10-25:** 89 tests and type/build checks passed. Actual Astro 7.4.2 with fixture-local Node.js 22.23.4 selected port 45322 while 45321 was occupied and served the expected page. A real VS Code session started the fixture, opened the native integrated browser through `simpleBrowser.show`, rejected duplicate startup, and stopped its owned server. Host/controller tests enforce workspace trust. Basic process cleanup is included now; Day 4's broader hardening checklist remains open.

### Day 4 — Preview cleanup and failure recovery — 6 hours

- [x] Stop the owned process tree on stop, project change, and extension disposal.
- [x] Verify failed scripts, missing executables, occupied ports, paths with spaces, and repeated start/stop.

**Acceptance:** A real fixture starts, opens the correct site, restarts, and leaves no owned server after disposal. An untrusted workspace cannot run project scripts.

**Verified 2026-10-25:** 102 tests and type/build checks passed. Regressions prove cleanup of stubborn descendants after leader exit, missing-executable/script recovery, cancellation, and retained ownership after a signalling error. Actual Astro completed repeated start/stop and disposal while preserving an unrelated occupied port. VS Code 1.143.1 verified live Stop/restart and awaited extension deactivation. Browser checks verified Stopping and failed-cleanup retry controls. Root-change races and workspace trust remain covered at the host/controller boundary; the verified process model is a foreground Linux dev-script group.

**Checkpoint:** If lifecycle reliability is unfinished, use the feature-cut policy below before starting content work.

### Day 5 — Local content browser and parser fixtures — 6 hours

- [x] Define and document the supported YAML subset before implementing form writes.
- [x] Enumerate nested `.md` files under `src/content/`; reject paths resolving outside the selected content root, including symlink escapes.
- [x] Display entry path, supported fields, and source-only diagnostics. Treat missing content directories as an empty state.
- [x] Create fixtures with unknown fields, CRLF, Unicode, nested paths, missing frontmatter, MDX, YAML aliases, duplicate keys, and multiline scalars.

**Acceptance:** The browser lists nested local Markdown entries, diagnoses unsupported content, and opens source without changing files or executing collection configuration. Path-containment checks pass.

**Verified 2026-10-25:** 142 tests and build/type checks passed. Real VS Code content discovery listed all seven fixture entries, opened native source, retained dirty buffers, and preserved saved bytes. Browser checks verified content selection, supported/source-only details, opaque source-open/refresh actions, and narrow layout. Canonical containment and scan/file limits pass. See `docs/content-support.md` and `docs/week-one-acceptance.md`.

**Week 1 review:** Demonstrate project selection, preview lifecycle, and content browsing. Review the supported YAML subset before form-write implementation. Re-estimate remaining work from actual progress.

**Review handoff:** Week 1 engineering checks are complete. The acceptance record includes the F5 demonstration and scope limits; user review is pending. Week 2 retains 18 planned implementation hours and 12 contingency/acceptance hours. Confirm the supported subset before Day 6 writes; do not add visual drag-and-drop to this budget.

### Week 2 — Safe editing, integrated workflow, and release

### Day 6 — Source-preserving form writes — 6 hours

- [x] Implement reads and bounded field replacements. Mark unsupported constructs source-only instead of normalizing them.
- [x] Verify untouched source spans remain byte-identical and invalid requests never write files.
- [x] Add forms for existing supported `title`, `description`, and `draft` fields. Do not invent missing fields or coerce unsupported types.
- [x] Apply one undoable document edit through VS Code APIs, using the document version captured when the form loaded.

**Acceptance:** Supported field changes are undoable and preserve unknown fields and body text. Unsupported constructs remain source-only. Stale document versions are rejected before applying edits.

**Verified 2026-10-26:** 169 tests and build/type checks passed. Actual VS Code verified one-step undo, dirty-buffer reads, unchanged disk bytes before explicit Save, stale-version refusal, unsupported-source refusal, and a live Astro title update after normal Save. Browser checks verified typed form submissions, preserved conflict drafts, explicit reload, and narrow layout. Forms remain unsaved editor operations; Day 7's realtime watchers and Git handoff remain open.

### Day 7 — Buffer conflicts and complete review workflow — 6 hours

- [x] Read current editor buffers, including dirty documents. Reject stale form versions with a reload action that preserves user input until explicitly discarded.
- [x] Require explicit save through normal document behavior; do not silently save unrelated dirty changes.
- [x] Refresh lists and forms on external saves; surface conflicts rather than overwriting active form edits.
- [x] Add Open Source for Markdown bodies and unsupported entries.

- [x] Add Source Control and native diff shortcuts for the selected entry.
- [x] Explain when the target has no Git repository; do not initialize one automatically.
- [x] Make list, form, status, and error controls keyboard-accessible and theme-aware.
- [x] Run the supported fixture's Astro validation/build to catch broken edited content.
- [x] Exercise open project, start preview, change supported fields, save, review diff, stop preview, and reopen Studio.
- [x] Freeze feature scope at the end of this day.

**Acceptance:** Change a title, undo it, save it, observe the preview update, and review the native diff. Concurrent source edits reject stale forms without changing source. Native Git actions retain normal credentials, hooks, and confirmations.

**Verified 2026-10-26:** Proactive editor/filesystem conflicts preserve form authority and drafts; saved-file refresh retains authorization and replays changes during initial scanning. Native Git review passed in a disposable real repository. Existing form/source/preview checks and the Astro static build pass. The panel retains context while hidden behind native tabs.

### Day 8 — Regression checks and installable candidate — 6 hours

- [x] Run build, typecheck, unit tests, and extension-host integration tests.
- [x] Verify the failure matrix: malformed metadata, untrusted workspace, failed start, occupied port, unsupported YAML, stale buffers, and external saves.
- [x] Inspect packaged files and exclude development fixtures, logs, and private data.
- [x] Package a VSIX and install it into a clean VS Code profile without relying on the development checkout.
- [x] Document setup, supported fields, source-only behavior, preview recovery, and platform limits.

**Acceptance:** The installed VSIX completes the fixture workflow. Record actual commands and exit codes rather than marking unchecked items successful.

**Verified 2026-10-26:** The 0.1.0 Linux x64 VSIX passes an exact ten-file allowlist and runtime asset equality checks. Clean installed trusted and actual Restricted Mode profiles pass with a standalone driver/copied Astro project. User guide, changelog, notices, checksum sidecar, and Linux CI workflow are included.

### Day 9 — Contingency and release hardening — 6 hours reserved

- [x] Fix release-blocking regressions only; add no new features.
- [x] Re-run checks affected by fixes and rebuild the packaged candidate when fixes change shipped files.
- [x] Confirm preview cleanup and content preservation from the clean installation.

**Acceptance:** Known release blockers are resolved or explicitly recorded. Any unfinished core gate prevents a finished-MVP claim. Unused reserve supports regression verification, not feature expansion.

**Verified 2026-10-26:** Filesystem-conflict bypass, atomic-save event coalescing, hidden-panel draft lifetime, and asynchronous native Undo observation are covered. The exact final installed candidate recheck passes. No additional product features were added during hardening.

### Day 10 — Final verification and user acceptance — 6 hours reserved

- [x] Complete remaining release-blocking fixes and verify the exact final packaged candidate with the acceptance commands below.
- [x] Repeat the complete edit-preview-review workflow from a clean installation.
- [x] Record delivered behavior, tested versions, remaining limitations, and any scope cuts in `docs/mvp-acceptance.md`.
- [x] Provide the installation/demo walkthrough and request user acceptance at handoff.

**Acceptance:** A locally installable, documented MVP with recorded evidence. If a core gate fails, report the actual working subset and the blocker; do not label it a finished CMS.

**Engineering result:** 180 tests across 17 files, type/build/audit checks, actual Astro lifecycle/static build, real Git review, exact package checks, installed trusted/Restricted Mode, and browser checks pass. The final artifact and checksum are recorded in `docs/mvp-acceptance.md`. Human acceptance is pending and is not claimed by the agent.

## 7. Verification contract

Day 1 defines these scripts; subsequent tasks use the same names:

```bash
npm run build
npm run typecheck
npm run test:unit
npm run test:integration
npm run package
```

All must exit with code 0 for the final candidate. `npm run package` must produce an installable VSIX; packaging alone does not prove runtime correctness. Run the fixture's own package-manager build separately and record its exact command after versions and fixture scripts are selected.

Meaningful automated coverage focuses on source preservation, path containment, protocol rejection, preview URL validation, document conflicts, and process lifecycle. Use manual Extension Development Host checks for visual layout and the complete user workflow. If a graphical test environment is unavailable, record that blocker and do not count integration acceptance as passed.

Final acceptance requires:

1. Clean-profile VSIX activation and explicit project selection.
2. Correct preview URL under a port collision and no owned process after stop/disposal.
3. Supported field edits with undo and unchanged unknown fields/body text.
4. Source-only behavior for unsupported syntax and conflict rejection for stale forms.
5. Successful target-fixture build after edits.
6. Native diff and Source Control handoff without automatic commits or pushes.

## 8. Scope-cut and failure policy

Cut convenience before correctness, in this order:

1. Remove custom native-diff shortcut; use Open Source and standard Source Control.
2. Limit the form to existing plain-string `title` only; keep other fields source-only.
3. Remove secondary UI polish while retaining labels, keyboard access, and actionable errors.
4. If safe form writes are still unfinished at the end of Day 7, ship the content browser with source editing and explicitly rename the result a workspace/content-browser preview.

Never cut path containment, workspace trust checks, document conflict detection, source preservation, owned-process cleanup, or truthful release evidence to hit the date. If these fail, delay the release or ship a smaller verified subset.

## 9. Approval checkpoint and next work

The user requested a two-week schedule, approved the initial daily work, and then authorized finishing all ten-day MVP work and publishing to `https://github.com/VJ-Ranga/astro-studio.git`. The focused scope remains unchanged; the larger visual editor/agents/deployment roadmap is not part of this release.

Day 1–10 implementation checklists and evidence are saved beside this plan and in `docs/development.md`. Install the VSIX and review `docs/mvp-acceptance.md`. Keep the full roadmap for later visual editing, provider adapters, richer Git integration, and deployment.
