# Astro Studio Development Roadmap

> **For agentic workers:** Use the executing-plans skill to implement an approved milestone task by task. Delegation requires explicit user approval. This document is the product roadmap; each milestone receives its own detailed implementation plan before coding.

**Goal:** Deliver a VS Code-first local Astro CMS with visual editing, coding-agent chat, real Git, and server deployment.

**Architecture:** A VS Code extension host owns project access and process execution. Typed webviews provide the CMS, preview controls, and chat. Ordinary Astro source files and the real Git repository remain authoritative.

**Tech Stack:** Proposed TypeScript, VS Code Extension API, React webviews, esbuild, Astro integration, native Git, and documented provider adapters.

## Global Constraints

- Direct VS Code support is the primary interface.
- Local workspace files remain the source of truth.
- Preserve unsupported Astro and MDX syntax instead of silently rewriting it.
- Do not overwrite dirty editor buffers or unrelated user changes.
- Do not store credentials in the project, Git history, or vault.
- Use real Git and respect hooks, authentication, and remote errors.
- Git push and server deployment are separate operations.
- Support OpenCode, Codex, and Claude Code through independently validated adapters.
- Do not commit, push, or deploy during development without the user's instruction.
- Verify a milestone before marking it complete.

---

## Milestone 0 — Planning and scope review

- [x] Select VS Code extension-first product direction.
- [x] Create the project documentation folder and linked Obsidian vault.
- [x] Draft architecture, roadmap, and first milestone plan.
- [ ] Review and approve the proposed product design.
- [ ] Approve milestone 1 scope and stack.

**Exit:** A reviewed design and an approved first implementation milestone. Documentation creation does not count as a working extension.

## Milestone 1 — Workspace and preview foundation

**Deliverable:** Open an existing Astro project, inspect its status, and start/stop its preview from VS Code.

1. Scaffold the extension, activation command, local debug configuration, and build scripts.
2. Discover and explicitly select an Astro project root.
3. Show a typed project-status panel and actionable diagnostics.
4. Detect package manager and dev script; launch a tracked process without shell-string interpolation.
5. Detect the actual preview URL and open it through VS Code's browser facilities.
6. Stop owned processes on command, project change, and extension disposal.
7. Verify ordinary, non-Astro, malformed, multi-root, untrusted, and space-containing project paths.

**Exit:** Repeatable Extension Development Host demonstration and passing targeted checks. See the separate first milestone plan.

## Milestone 2 — File-aware content CMS

**Deliverable:** Browse supported local content collections and edit entries without losing source fidelity.

1. Research the selected Astro version's collection and loader APIs.
2. Define supported schemas, loaders, and frontmatter formats.
3. Implement collection discovery with explicit unsupported-state diagnostics.
4. Build entry lists and schema-driven forms for text, numbers, booleans, dates, enums, and references.
5. Apply edits through document APIs with version checks and undo support.
6. Preserve unknown frontmatter fields and body content.
7. Add create, rename, and explicit delete workflows with path validation.
8. Detect external edits and refresh entry state.

**Exit:** Round-trip fixtures retain unknown fields and body text; dirty-document and validation conflicts are demonstrated. Custom remote loaders remain explicit supported/unsupported cases, not assumed local files.

## Milestone 3 — Markdown, MDX, and media

**Deliverable:** Edit article bodies and manage local media with accurate site preview.

1. Add Markdown editing and preview navigation.
2. Use source-first MDX editing until supported visual constructs are explicitly defined.
3. Import local images with collision handling and configured asset locations.
4. Support alt text and documented public-versus-imported image references.
5. Resolve content pages through a project-aware route mapping.
6. Add viewport presets, refresh, and dev-server error visibility.

**Exit:** Images and links resolve in a built Astro fixture. Unsupported MDX is preserved byte-for-byte outside intended edits.

## Milestone 4 — Supported-component visual editor

**Deliverable:** Select, configure, reorder, and insert registered Astro components.

1. Validate Astro parser/source-location compatibility against fixtures.
2. Define the component registry for editable props, slots, and insertion rules.
3. Add preview instrumentation for stable source-to-element mapping in development only.
4. Add selection overlay and source navigation.
5. Implement bounded prop and slot edits with source version checks.
6. Add drag-and-drop within supported containers, with undo/redo.
7. Preserve imports, frontmatter, comments, expressions, and hydration directives.
8. Show unsupported-state explanations instead of destructive fallback conversions.

**Exit:** Representative edited fixtures parse and build. Instrumentation does not ship in production output. Dynamic components and nested slots have documented behavior.

## Milestone 5 — Chat framework and first agent

**Deliverable:** One real coding agent works from an integrated chat panel against the selected workspace.

1. Check official OpenCode, Codex, and Claude Code integration capabilities and authentication requirements.
2. Select the first provider based on documented transport and local availability.
3. Define provider capabilities, session lifecycle, streaming events, tool events, and cancellation.
4. Implement the first adapter and chat panel.
5. Expose connection state, errors, cancellation, and session restart.
6. Show changed-file diffs and make partial edits visible after failures.
7. Add opt-in transcript persistence and deletion.

**Exit:** The actual provider performs a small workspace edit, which appears in the editor and Git diff. Verify cancellation and failed authentication without leaking credentials.

## Milestone 6 — OpenCode, Codex, and Claude Code coverage

**Deliverable:** All three requested providers have tested adapters or clearly documented capability limits based on actual provider support.

1. Implement each remaining provider independently.
2. Expose provider-specific capabilities instead of pretending all sessions are identical.
3. Add provider selection and per-project session association.
4. Verify restart, context behavior, cancellation, and process cleanup for each provider.
5. Document required installations and authentication setup.

**Exit:** Run the same edit-and-review scenario with each supported provider. Existing proprietary VS Code extension sessions are not automatically shared.

## Milestone 7 — Integrated real Git workflows

**Deliverable:** Users can review and publish source changes using their real repository.

1. Reuse native Source Control for status and standard diff views where practical.
2. Add CMS/agent shortcuts to changed files and diffs.
3. Implement explicit stage, unstage, and commit actions if native controls leave a real workflow gap.
4. Add branch selection, fetch, pull, and push with clear remote/upstream state.
5. Handle rejected pushes, hooks, unmerged files, and authentication errors.
6. Link conflict resolution to VS Code's existing tools.

**Exit:** Verify against temporary repositories and a local bare remote, including rejected pushes and merge conflicts. No force push by default.

## Milestone 8 — Build and server deployment

**Deliverable:** Publish a validated Astro build to one explicitly chosen server target.

1. Choose the first server, deployment transport, rendering mode, and authentication method.
2. Define build, check, upload, activate, health-check, and rollback stages.
3. Implement Git-triggered deployment or SSH release-directory deployment for the selected target.
4. For static output, validate output directory and asset paths.
5. For server rendering, define the Astro adapter, runtime, service restart, and reverse proxy requirements.
6. Display deployment logs and release status with sensitive values redacted.
7. Verify failure recovery on a disposable target before using a real server.

**Exit:** Successful deployment, failed-build prevention, failed-release handling, and rollback are demonstrated for the chosen recipe. Other targets receive separate recipes.

## Milestone 9 — Product hardening and distribution

**Deliverable:** Installable VSIX with documented support and repeatable release checks.

1. Audit extension lifecycle, webview messages, process cleanup, and editor conflicts.
2. Verify supported platform and Astro version combinations.
3. Add accessibility, keyboard navigation, and large-project responsiveness checks.
4. Package the extension and install the VSIX into a clean VS Code profile.
5. Document setup, supported features, limitations, recovery, and provider configuration.
6. Add CI build/type/test/package checks and a release checklist.

**Exit:** A clean installation can complete the documented content-edit, preview, agent-edit, Git, and deployment workflow.

## Per-milestone development loop

1. Review the previous milestone's verified behavior.
2. Write the milestone-specific design and implementation plan.
3. Approve scope and interfaces.
4. Implement one independently testable slice at a time.
5. Run relevant checks and capture concise evidence.
6. Review the working deliverable with the user.
7. Update the Obsidian progress and decisions notes.
8. Commit only when instructed; then proceed to the next milestone.
