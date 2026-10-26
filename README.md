# Astro Studio

A local-first Astro content editor inside VS Code: supported-field forms, real site preview, conflict-aware source edits, and native Git review.

**Preview version:** 0.1.0. Target: Linux x64 desktop, VS Code 1.143.1 or newer. Astro Studio is a working name and is not affiliated with the Astro project.

## Install

Download the `astro-studio-linux-x64` artifact from a successful [GitHub Actions run](https://github.com/VJ-Ranga/astro-studio/actions), extract it, and run **Extensions: Install from VSIX…** in VS Code. Choose `astro-studio-0.1.0-linux-x64.vsix`.

To build locally:

```bash
npm ci
npm run package
```

The VSIX and SHA-256 sidecar are written to `artifacts/`. No Marketplace account is required for local VSIX installation.

## Use

1. Open an existing Astro project with its dependencies installed and a working `dev` script.
2. Run **Astro Studio: Open Studio**. Select a root explicitly in multi-root workspaces.
3. Use **Start preview** in a trusted workspace. Studio opens the actual emitted local URL.
4. Select a Markdown entry under **Local content**, then choose **Edit fields**.
5. Change existing supported fields and choose **Apply to editor**. Select the opened source editor and save normally to update the site.
6. Use **Review diff** or **Source Control** to review and publish through native Git controls.

Apply is one undoable native editor edit and never saves automatically. Concurrent source changes retain the form draft and require explicit reload. Unknown fields, comments, line endings, and body text outside intended scalar edits are preserved.

## Scope

- Local Astro root discovery, package-manager diagnostics, and workspace trust checks.
- Owned preview start/stop, actual URL detection, bounded logs, and process-group cleanup.
- Bounded Markdown/MDX browsing and source-only diagnostics.
- Existing `title`/`description` string fields and `draft` boolean forms in the documented YAML subset.
- Proactive editor/external-save conflicts, saved-file refresh, and retained active drafts.
- Native source editing, Source Control, and diff handoff using the real repository.

MDX, aliases/anchors, tags, duplicate keys, multiline scalar syntax, and unsupported fields remain source-only. No arbitrary Astro file is visually rewritten. Visual component drag-and-drop, agent chat, media management, project generation, deployment, and additional operating systems remain later milestones.

## Development and verification

```bash
npm run typecheck
npm run test:unit
npm --prefix "tests/fixtures/preview site" ci
ASTRO_TELEMETRY_DISABLED=1 npm run test:preview
ASTRO_TELEMETRY_DISABLED=1 npm run test:integration
npm run package
ASTRO_TELEMETRY_DISABLED=1 npm run test:installed
```

Editor tests need a graphical display; use `xvfb-run -a` on headless Linux. `VSCODE_EXECUTABLE_PATH=/usr/share/code/code` selects an existing editor binary. Otherwise the test runner downloads the pinned VS Code version. F5 launches the extension from source.

## Documentation

- [User guide](docs/user-guide.md)
- [Content and YAML support](docs/content-support.md)
- [Development and verification evidence](docs/development.md)
- [MVP acceptance record](docs/mvp-acceptance.md)
- [Two-week delivery plan](docs/superpowers/plans/2026-10-25-two-week-mvp.md)
- [Full product roadmap](docs/superpowers/plans/2026-10-25-astro-studio-roadmap.md)

The repository retains its `UNLICENSED` status. Bundled dependency licenses are included in [third-party notices](THIRD_PARTY_NOTICES.txt). The VSIX uses the local publisher identity `astro-studio-local` and is not a Marketplace publication.
