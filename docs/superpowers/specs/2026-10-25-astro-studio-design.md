# Astro Studio — Proposed Product Design

Date: 2026-10-25
Status: Proposed for user review
Platform direction: VS Code extension first, approved by the user

## 1. Goal

Build a local-first environment inside VS Code for editing Astro content and supported page components, previewing changes, collaborating with coding agents, tracking changes through real Git, and publishing to a server.

The existing Astro workspace remains an ordinary project. Users can edit it without this extension. The extension does not replace Astro or require a proprietary project format.

## 2. Confirmed requirements

- Direct VS Code support as the primary interface.
- Local CMS and eventual visual component editing.
- Chat support for OpenCode, Codex, and Claude Code.
- Real Git operations, including pushing to a remote repository.
- Server deployment.
- Full, step-by-step development with verification between milestones.
- Project documents under Documents and a separate Obsidian project vault.

## 3. Proposed implementation choices

These choices need review before application development:

- TypeScript extension host and React/TypeScript webviews, bundled with esbuild.
- npm for developing the extension. Detect the target Astro project's package manager instead of forcing npm on target projects.
- Linux desktop VS Code is the first verified platform. Test Windows and macOS in the packaging milestone before claiming support.
- Operate on one explicitly selected local workspace root initially. A multi-root workspace requires root selection; never silently choose a project.
- Start with an existing Astro project. Project generation follows after existing-project support works.
- Prefer VS Code's native terminal, Source Control interface, authentication, and editor APIs where possible.
- Do not require a database or cloud service for core local editing.
- Pin the supported VS Code, Node.js, Astro, and dependency versions during milestone 1 after checking their current official compatibility requirements. Commit the extension lockfile then.

## 4. Approaches considered

### A. VS Code extension first — selected direction

The extension hosts CMS, preview, and agent panels. The extension host coordinates filesystem access, child processes, Git, and deployment. This reuses existing editor behavior and gives direct access to unsaved documents.

Trade-off: webview isolation and extension lifecycle require careful boundaries. Browser-only distribution would require an additional host later.

### B. Local browser application with a thin extension

A local service owns all functionality and the extension links into it.

Trade-off: easier independent browser UI, but more process management, authentication, and synchronization work for the initial product.

### C. Standalone desktop application with editor integration

An Electron or Tauri application provides a complete separate environment.

Trade-off: greater window control, but duplicates editor, terminal, Git, packaging, and update capabilities already available in VS Code.

## 5. Architecture

### Extension host

Owns privileged operations: workspace selection, document edits, project discovery, dev-server lifecycle, agent processes, Git access, and deployment commands. All operations resolve against the selected project root.

### Webview UI

Provides CMS forms, media browsing, visual controls, chat, and deployment status. A typed, versioned message protocol validates incoming requests in the extension host. Webviews do not receive arbitrary filesystem or shell access.

### Workspace layer

Reads actual project files and applies edits through VS Code document APIs. It distinguishes saved files from dirty editor buffers, checks document versions, and reports conflicts instead of silently overwriting changes. File watchers update the UI after external edits.

### Astro integration

Detects project metadata and package scripts without evaluating configuration during discovery. Starting the development server or performing a build executes the user's project through its selected package manager. Project execution respects VS Code workspace trust.

Collection discovery must account for version differences, runtime schemas, custom loaders, and executable configuration. Static inspection alone cannot reliably reconstruct every schema. Offer explicit supported configurations and diagnostics; add an opt-in runtime bridge for advanced schemas in the CMS milestone.

### Visual editing

Use a supported-component registry with editable props, slots, and source locations. Transform Astro source with a compatible parser and bounded source edits. Never round-trip an arbitrary Astro file through HTML serialization.

Unsupported expressions, dynamic constructs, and components remain editable in the code editor. Visual controls explain their unsupported state. This is necessary to preserve frontmatter, imports, comments, slots, expressions, and hydration directives.

### Agent integration

Each provider adapter declares capabilities: availability, session start/resume, streaming events, cancellation, tools, and authentication source. Validate each provider's current documented SDK, protocol, or CLI mode before selecting its transport.

Use provider-supported authentication. Do not read private credential stores or assume that existing VS Code agent extensions expose reusable chat APIs. Initial adapters can share the project directory while remaining separate sessions. Show resulting workspace changes through diffs.

### Git and deployment

The real `.git` repository is authoritative. Use native Source Control for the first milestone and add product-specific controls later. Detect Git conflicts and failed pushes explicitly. Respect existing hooks and credentials; do not bypass them.

Deployment is distinct from Git push. Git-triggered deployment needs a configured server workflow. Direct deployment needs a build, destination, transport, release activation, and failure recovery. Static and server-rendered Astro sites require separate deployment recipes.

## 6. End-to-end workflow

1. Open a local Astro project in VS Code and select the project root.
2. Open Astro Studio and review project detection results.
3. Start preview using the project's development command.
4. Edit content in CMS forms or source files; observe live preview updates.
5. Use supported visual controls for component edits.
6. Ask a connected agent to change the project; inspect changed files.
7. Review diffs, stage intended files, and commit.
8. Pull or push through the existing Git remote.
9. Run build checks and deploy through the selected deployment recipe.

## 7. Data and state

- Content and components: original Astro workspace files.
- Project settings: a documented `.astro-studio.json` file introduced only when a milestone requires project-specific settings.
- User preferences: VS Code settings.
- Machine-local UI state: VS Code workspace state.
- Secrets: provider-supported authentication or VS Code SecretStorage where appropriate; never project configuration or Obsidian notes.
- Agent transcript persistence: opt-in local storage with a documented location and deletion command, introduced with chat.

## 8. Failure behavior

- Missing or malformed package.json: show actionable diagnostics; do not start processes.
- Non-Astro project or ambiguous root: request explicit project selection.
- Dirty editor document or version conflict: use the current buffer or require explicit conflict resolution before applying the edit.
- Existing dev server: attach only after confirming its project and endpoint; otherwise start and manage an owned process.
- Child-process exit: retain bounded diagnostic output and offer restart.
- Invalid content: show field errors without destroying source data.
- Unsupported MDX or schema: retain source and offer source editing.
- Agent interruption: stop owned session work and show any partial file changes.
- Git conflict: expose native conflict tools and block dependent publishing until resolved.
- Deployment failure: keep the last known working release active where the deployment recipe supports release directories.

## 9. Verification strategy

Use representative Astro fixtures rather than tests that repeat implementation internals. Include projects with spaces in paths, multi-root workspaces, dirty documents, nested content, unsupported schemas, and dynamic Astro syntax.

Test extension-host commands in VS Code's extension test environment. Unit-test pure protocol, parsing, and serialization modules. Use temporary Git repositories and a local bare remote for Git scenarios. Test deployments against a disposable local SSH/container target before a real server. Run build and type checks for every release candidate.

## 10. Delivery boundaries

The first delivery is workspace discovery and owned preview lifecycle. Later deliveries add CMS, visual editing, one agent integration, additional agents, advanced Git workflows, deployment, and packaging. Every milestone must have independently reviewable acceptance criteria.

No claim is made that arbitrary Astro projects can be visually edited losslessly, that every agent exposes the same API, or that every server supports the same deployment model.

## 11. Review decisions

The next review should approve or revise the proposed stack and milestone 1. Content schema coverage is decided before milestone 2. The first agent provider is chosen after capability research. The server target and rendering mode are chosen before deployment implementation.
