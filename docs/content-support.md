# Local content support

## Current browser and supported forms

Studio inspects saved `.md` and `.mdx` files under the selected Astro project's `src/content/` directory. It does not discover executable collection schemas or invoke local/remote loaders during discovery. A missing directory is an empty state. Browsing is read-only; Day 6 additionally provides explicit native editor edits for supported existing fields. Studio does not create, rename, delete, or automatically save content.

Entries can be selected to inspect their fields and diagnostics. **Open source** opens the current file through VS Code, preserving existing dirty editor buffers. Use **Refresh content** after external saves to reload the saved-file snapshot.

For a supported entry, **Edit fields** reads the current VS Code buffer, including unsaved changes. **Apply to editor** replaces only changed supported scalar values in one undoable editor operation. Select the opened source editor and use normal VS Code Save to persist changes and update Astro preview. Missing fields are not created and unsupported types are not coerced.

## Supported frontmatter subset

- An opening `---` line at the start of the document, optionally after a UTF-8 BOM, and a closing `---` line.
- LF or CRLF line endings; source text and Markdown body remain untouched.
- A single YAML 1.2 mapping with unique string keys.
- Existing `title` and `description` values that are strings of at most 4096 characters represented by a single source-line scalar: plain, single-quoted, or double-quoted.
- Existing `draft` values that are booleans (`true` or `false` under YAML 1.2).
- Ordinary comments, unknown scalar fields, and ordinary unknown mappings/sequences. Unknown data is retained and does not become editable fields.

The analyzer reports source ranges for supported values. Changed strings become escaped double-quoted YAML scalars; booleans become `true` or `false`. Unchanged values keep their original spelling. Comments, unknown data, line endings, BOM, and body text outside the replaced values remain untouched. The result is reparsed and its field values verified before any editor edit. A supported label is a syntax-coverage statement, not Astro schema validation.

Strings may contain logical newlines represented by escaped characters in the new single-line YAML scalar. Block/multiline source syntax remains unsupported. Editing also enforces the 1 MiB document limit before and after replacements.

## Versions, sessions, and conflicts

Forms carry a host-generated session token and captured document version. The host retains the canonical URI and source fingerprint, rechecks entry authorization, and compares the current version/fingerprint before editing. Native `TextEditor.edit` provides the version-bound edit; a rejected edit is reported as a conflict without retrying stale replacements.

The form draft survives validation/conflict messages and inspection of another entry while the same form session remains active. **Reload fields (discard form changes)** is explicit and replaces that draft with current editor values. Loading a different form replaces the single active host session. Root changes and disposal invalidate old sessions; submitted paths, ranges, unknown fields, and arbitrary commands are rejected.

The entry list describes saved files and refreshes after content filesystem/save events. Native document changes proactively mark a stale form conflicted without replacing its token or values; save events update dirty/save state when the captured source remains current. Filesystem events are coalesced before inspection so atomic saves are evaluated in their final state. Normal content refreshes within the same project retain the active form draft; apply still revalidates authorization, version, and fingerprint.

The panel retains its browser context while hidden behind native source/diff tabs. Closing the Studio panel intentionally ends that browser-local draft lifetime; reopening loads host session values. A source document can always be reviewed through native Open Source, Source Control, and diff actions.

## Source-only entries

MDX always remains source-only. Markdown is also source-only when frontmatter is missing, unterminated, invalid, not a mapping, or has no recognized supported field.

Unsupported YAML includes aliases/anchors, explicit tags, merge keys, directives, duplicate keys, non-string mapping keys, block/multiline scalar syntax, and unsupported types for recognized fields. When any such construct occurs, the entire entry remains source-only. Diagnostics explain the reason; source remains openable and unchanged.

## Filesystem and scan limits

Studio resolves the project and content root canonically. A content root outside the project is rejected. Escaping file symlinks are rejected; internal file symlinks are checked again before source opening. Directory symlinks are skipped to avoid cycles. Special files are not read.

Limits: 1 MiB per file, 200 displayed entries, 500 scanned directories, directory depth 12, and 40 scan diagnostics. Reaching a limit produces a diagnostic. Oversized/unreadable local files may appear as source-only entries; paths escaping the authorized content root are never offered as openable entries.

Open Source authorizes an opaque ID from the current scan, rechecks canonical containment, and opens the canonical local path. It does not accept a path, URL, shell command, or ID from a previously selected project.
