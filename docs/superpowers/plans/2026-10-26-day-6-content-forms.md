# Day 6 Source-Preserving Content Forms Implementation Plan

> Execute inline with executing-plans. The user's “next day” request approves Day 6 after the Week 1 YAML-contract handoff. Do not delegate, commit, or push.

**Goal:** Edit existing supported title, description, and draft fields through forms, preserving every source span outside the intended scalar replacements and providing native undo without automatic saves.

**Architecture:** A pure replacement planner reuses the approved YAML analyzer. A VS Code document coordinator owns form sessions, source fingerprints, document versions, and version-bound `TextEditor.edit` operations. The content browser continues to authorize canonical paths; webviews submit only an entry ID, opaque session token, captured version, and typed field values.

## Editing contract

- Existing supported fields only. Never create a missing field, coerce types, edit MDX, or write source-only entries.
- Changed strings become JSON-compatible double-quoted YAML scalars; booleans become `true`/`false`. Unchanged values retain their original source spelling. Preserve comments, unknown fields, BOM, line endings, and body outside replaced value ranges.
- Validate field names/types and the 4096-character string limit in both protocol and planner. Reparse the planned result and verify requested values before invoking an editor edit.
- Load the current VS Code buffer, including unsaved changes, rather than trusting the browser's saved-file metadata.
- Each form load receives a host-generated session token and document version. Keep the source fingerprint and canonical URI in the host. Resolve the current authorized entry again before applying.
- Recheck version and fingerprint after every asynchronous boundary and immediately before `TextEditor.edit`. Use one native edit with undo stops before/after. A rejected native edit becomes a conflict; do not retry stale replacements.
- **Apply to editor** leaves changes unsaved. The user uses VS Code Save to update the actual site. No automatic save or filesystem writes.
- Preserve the local form draft on validation errors/conflicts. Reload is explicit and labelled as discarding form changes. One active host session is supported; reading another form intentionally replaces that session.
- Root changes and disposal invalidate active form sessions. Entry refresh invalidates scan IDs while it runs; same-project form drafts remain, and every apply reauthorizes against the current scan. No writes use paths, ranges, or commands supplied by the webview.

## Interfaces and files

Create `src/content/content-edits.ts`: `planContentEdits(source, changes, extension)` returns validated nonoverlapping scalar replacements. It never writes files.

Create `src/content/content-documents.ts`: `load(id)`, `apply(request)`, `reset()`, `dispose()`, and a serializable form-state snapshot. It resolves IDs through `ContentController.resolve(id)` and uses native VS Code documents/editors.

Extend the protocol with exact `editContent` and `applyContent` requests. Add `webview/content-form.tsx`; use typed message objects for browser requests. Keep source-only content inspection and preview controls intact.

## Tasks

### 1. Scalar replacement planning

- [x] Write failing preservation tests for BOM, CRLF, Unicode, comments, unknown nested YAML, unchanged quote style, strings requiring escaping, and boolean changes.
- [x] Reject unsupported syntax/types, missing/unknown fields, oversized inputs, and invalid post-edit parsing.
- [x] Implement bounded scalar replacement planning and verify fixtures.

### 2. Native document sessions and conflict detection

- [x] Write tests for current dirty buffers, stale versions, expiry/root invalidation, atomic-edit rejection, duplicate requests, and no automatic save; verify missing session/edit behaviors fail before implementation.
- [x] Implement host-generated sessions, canonical resolution, fingerprint/version checks, one undoable native edit, and explicit conflict state.
- [x] Update protocol tests to reject arbitrary paths/ranges, extra payload fields, invalid tokens/versions, and untyped values.

### 3. Supported forms

- [x] Add existing-field inputs, Apply to editor, and explicit Reload fields controls.
- [x] Keep draft input when apply fails or conflicts; block duplicate submissions and source-only edits.
- [x] Show the dirty-buffer snapshot and normal VS Code Save instruction. Preserve the draft when inspecting another entry and returning to the active form.

### 4. Editor and preview verification

- [x] Verify actual VS Code apply, one-step undo, dirty buffers, unchanged saved bytes, stale-version rejection, and unsupported-source preservation.
- [x] Extend the Astro fixture with a normal supported content collection so explicit Save updates the rendered title. Restore the fixture's original content during test cleanup.
- [x] Run build, type checks, unit, Astro lifecycle, editor, and browser checks; record exact results and update Day 6 progress.

Realtime external-change watchers, richer conflict recovery, and native Git handoff remain Day 7. Drag-and-drop remains a later milestone.
