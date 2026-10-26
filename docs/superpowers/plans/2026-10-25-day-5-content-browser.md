# Day 5 Content Browser and Week 1 Acceptance Plan

> Execute inline with executing-plans. The user requested completion of Week 1; Days 1–4 are already verified. Finish Day 5 and the Week 1 acceptance review. Do not delegate, commit, or push.

**Goal:** Browse nested local Markdown/MDX files, inspect supported fields and source-only diagnostics, and open source in VS Code without changing content.

**Architecture:** A bounded filesystem scanner and YAML analyzer remain independent of VS Code. A content controller owns the current project, scan generation, and authorized entry IDs. Studio displays the read-only browser; fixed Open Source requests carry only an opaque entry ID and are checked again against canonical path containment before opening.

**Tech stack:** Existing TypeScript/React/VS Code tooling plus exact `yaml@2.9.1`. Use YAML syntax nodes and source ranges; never evaluate project configuration, resolve aliases into objects, serialize files, or execute collection loaders.

## Approved scope interpretation

Week 1 ends with Day 5. Content forms and writes belong to Day 6. The browser is a local-file browser, not automatic Astro schema discovery or a visual page builder.

Use the existing VS Code-themed panel. Add a content section with a selectable file list, supported/source-only labels, read-only field details, diagnostics, Refresh content, and Open source. A standalone browser service adds unnecessary lifecycle work; native source-only navigation alone would omit the requested content inspection. Keep all file writes out of this delivery.

## YAML support contract

See `docs/content-support.md` for the canonical subset. Analyze an initial `---` frontmatter block, including UTF-8 BOM and LF/CRLF. Require one YAML 1.2 mapping with unique string keys. Existing `title` and `description` must be single-line-source scalar strings, and existing `draft` must be a boolean. Preserve all source bytes; unknown fields may include ordinary mappings/sequences but are not edited.

Aliases, anchors, custom tags, merge keys, directives, duplicate keys, multiline scalar syntax, invalid YAML, absent/unterminated frontmatter, unsupported known-field types, and MDX are source-only. No recognized supported fields also means source-only. These cases remain openable in the source editor.

## Boundaries

- Scan only `src/content/` beneath the selected local Astro project. Treat a missing directory as an empty state.
- Resolve the project and content directory canonically; never accept a content root outside the project.
- Resolve every candidate against the canonical content root. Reject escaping file symlinks. Skip directory symlinks to avoid cycles. Internal file symlinks may be inspected only after containment checks.
- Limit a file to 1 MiB, a scan to 200 entries/500 directories, depth to 12, and global diagnostics to 40. Report truncation and skipped files. Reject special files before reading; never block on a FIFO.
- Entry IDs include the canonical project root and relative path. Open Source accepts only an ID from the current scan, rechecks membership after asynchronous work, and opens the canonical file path. Root changes/disposal invalidate older scans and IDs.
- Browsing reads saved files. Opening source uses VS Code's existing document buffer and does not save or overwrite dirty documents. Buffer-aware form editing remains Week 2 work.

## Tasks

### 1. Read-only parser, fixtures, and discovery

Create `src/content/content-types.ts`, `src/content/frontmatter.ts`, `src/content/content-files.ts`, `src/content/list-entries.ts`, parser/containment tests, and representative fixtures.

- [x] Write failing parser cases for supported fields, unknown data, Unicode, BOM, CRLF, aliases, duplicate keys, multiline scalars, malformed frontmatter, and MDX.
- [x] Implement syntax-node inspection and supported-field ranges without serialization or writes.
- [x] Write failing filesystem cases for nested files, missing directories, symlink escapes, internal symlinks, special files, and scan/file limits.
- [x] Implement bounded canonical-path discovery with per-entry and scan diagnostics.

### 2. Content state and source navigation

Create `src/content/content-controller.ts`, `webview/content-view.tsx`, and controller/rendering tests. Update `src/extension.ts`, `src/panel/messages.ts`, the main webview, and styles.

- [x] Verify current-scan ID authorization, stale scans, and symlink replacement before opening.
- [x] Add `refreshContent` and exact `{version: 1, type: 'openContent', id}` requests; reject arbitrary paths, extra fields, and unknown IDs.
- [x] Load content for the selected Astro root, clear state on root removal, and dispose pending scan state on shutdown.
- [x] Show selectable entries, read-only field details, supported/source-only status, actionable diagnostics, and source navigation.

### 3. Week 1 verification and review

Extend the runnable fixture with content and extend editor/browser tests. Add `docs/week-one-acceptance.md`.

- [x] Run build, type checks, and all unit tests.
- [x] Verify real VS Code discovery, content listing, Open Source, unchanged content bytes, preview restart, and awaited shutdown.
- [x] Run actual Astro occupied-port/lifecycle verification and browser content selection/navigation checks.
- [x] Record delivered behavior, source-only limitations, tested versions, remaining Week 2 scope, and verification results. Update README and mark Day 5 complete only after the checks pass.
