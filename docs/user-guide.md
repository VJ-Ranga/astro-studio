# Astro Studio user guide

## Requirements and installation

This preview targets Linux x64 desktop VS Code 1.143.1 or newer. The project must already be an Astro project with a working Node.js runtime, installed dependencies, a declared Astro dependency, and a `dev` script. Astro Studio does not install target-project dependencies.

Build the VSIX with `npm ci && npm run package`, or download the `astro-studio-linux-x64` artifact from the repository's successful GitHub Actions run. Extract the artifact, then use **Extensions: Install from VSIX…** and select `astro-studio-0.1.0-linux-x64.vsix`. Reload VS Code if requested.

The artifact includes a SHA-256 sidecar. Check it with `sha256sum -c astro-studio-0.1.0-linux-x64.vsix.sha256` from the extracted folder.

## Open a project

Open an existing local Astro folder, then run **Astro Studio: Open Studio** from the Command Palette. With multiple workspace roots, choose one explicitly. The panel shows the selected root, declared Astro version, package manager, dev script, trust state, and diagnostics.

An explicit `packageManager` takes precedence. Conflicting inferred lockfiles remain unresolved until you choose a manager in project metadata. Discovery reads metadata without importing executable Astro configuration or collection loaders.

## Preview

**Start preview** executes the selected package manager's `run dev` command in the project root. It requires a trusted workspace. Studio opens the actual labelled Local URL; occupied ports are handled through Astro's emitted alternative URL. It never guesses ownership from a default port or attaches to an unrelated server.

Use **Show preview logs** for the bounded output tail, **Open preview** to reopen the native browser, and **Stop preview** to stop Studio's owned process group. Closing the Studio tab leaves the preview running; changing roots or shutting down the extension stops it. A Stopping state blocks replacement startup. If cleanup fails, use Stop to retry; Start remains blocked until ownership is cleared.

The verified process model is a foreground Linux dev script. Intentional daemonization into a separate session is outside that model. Missing executables, dependency failures, and startup timeouts produce actionable logs and failed state.

## Content forms and source editing

Studio browses saved `.md` and `.mdx` files under `src/content/`. Select an entry to inspect metadata. **Open source** works for bodies and unsupported entries. **Edit fields** loads the current native buffer, including unsaved changes.

Forms edit only existing supported `title`/`description` strings and `draft` booleans. **Apply to editor** replaces changed scalar values as one undoable operation. Comments, unknown fields, line endings, and body text outside those values are preserved. No automatic save occurs. Select the opened source editor and save normally to update the actual site.

Editor changes and external saves mark stale forms conflicted without replacing the draft. **Reload fields (discard form changes)** explicitly loads current editor values. Inspecting another entry and returning retains the active draft. Opening a different form or changing projects replaces the single active form session. The panel retains its context when hidden behind native editor/diff tabs; closing the panel intentionally ends its browser-local draft lifetime.

Source-only cases include MDX, missing/invalid frontmatter, aliases/anchors, tags, merge keys, duplicate/non-string keys, multiline scalar syntax, unsupported known-field types, and documents without recognized fields. Unknown ordinary YAML mappings/sequences remain unchanged. Strings are limited to 4096 characters. The entry list describes saved files and refreshes after saves/filesystem changes; forms describe the current editor buffer.

Scans are bounded to 200 entries, 500 directories, depth 12, 1 MiB per file, and 40 diagnostics. Escaping roots/symlinks and special files are rejected; directory symlinks are skipped. Linux process cleanup uses readable `/proc` process metadata.

## Review with Git

Save intended content changes, then choose **Review diff** for the selected entry or **Source Control** for the project. Studio uses VS Code's built-in Git extension and real repository. Untracked/unchanged entries follow native Git command behavior. Missing repositories are explained; initialization is always an explicit native Source Control action.

Use native Git controls for staging, commits, branches, pull, and push. Credentials, hooks, rejected pushes, and conflicts remain native Git/VS Code behavior. Studio does not automatically stage, commit, or publish your content.

## Recovery and support boundaries

- Resolve malformed package metadata or manager conflicts, then refresh the project.
- Check the project's own Node.js/package-manager installation and dependencies when preview startup fails.
- Inspect logs, stop the owned server, then retry. Studio does not stop external listeners.
- Keep a conflicted form draft until you intentionally reload it; use the source editor to review concurrent changes.
- Use native Git diff/conflict tools before committing or publishing.

This release is a local-file CMS/preview foundation. It is not yet a visual drag-and-drop builder and does not include agent chat, media upload, project generation, deployment, or Marketplace publication. The local publisher identity is `astro-studio-local`; no Astro-project affiliation is claimed. The repository retains its UNLICENSED status.
