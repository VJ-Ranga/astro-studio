# Astro Studio 0.1.0 MVP Acceptance

Date: 2026-10-26
Status: Ten-day engineering scope implemented and locally verified. Human acceptance remains a user review checkpoint.

## Deliverable

- Linux x64 VSIX: `artifacts/astro-studio-0.1.0-linux-x64.vsix`
- Version: 0.1.0; local publisher ID: `astro-studio-local.astro-studio`
- Editor floor and tested version: VS Code 1.143.1
- Artifact size: 131,012 bytes
- Local verified artifact SHA-256: `8d55e211fe9aea0034ddbecbcc9767c3af1423429b39f90422020cf8b44c0e51`
- Source repository: https://github.com/VJ-Ranga/astro-studio

CI rebuilds generate their own checksum sidecars; ZIP timestamps can change the archive checksum without changing the versioned source. Verify each downloaded artifact against its accompanying sidecar.

## Delivered scope

1. Explicit local Astro root selection and read-only metadata discovery.
2. Trusted, owned preview startup with actual local URL detection, bounded logs, stop/restart, and awaited cleanup.
3. Bounded Markdown/MDX browsing, canonical containment, supported-field inspection, and native source navigation.
4. Existing title/description/draft forms using scalar-only, version-bound, undoable editor edits and explicit native saves.
5. Proactive editor/external-save conflicts, retained active drafts, saved-file refresh, and explicit reload recovery.
6. Real native Source Control and selected-entry diff handoff; missing repositories are explained without automatic initialization.
7. A bundled, allowlisted VSIX, user guide, third-party notices, and Linux CI with downloadable artifacts.

Visual drag-and-drop, arbitrary Astro component rewriting, coding-agent adapters, media management, deployment, Marketplace publication, and other operating systems remain outside this MVP.

## Verification evidence

| Check | Actual result |
| --- | --- |
| `npm run test:unit` | 180 tests across 17 files passed, exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm audit` | 0 vulnerabilities |
| `ASTRO_TELEMETRY_DISABLED=1 npm run test:preview` | Actual Astro 7.4.2 occupied-port startup, duplicate rejection, 3 start/stop cycles, awaited disposal, and unrelated-listener preservation passed |
| `ASTRO_TELEMETRY_DISABLED=1 npm --prefix "tests/fixtures/preview site" run build` | One-page static Astro build succeeded, exit 0 |
| Development editor suite | No-folder, metadata-only, live Astro/content, and disposable real Git sessions passed on VS Code 1.143.1 |
| `npm run package` / `npm run test:package` | Ten-file allowlist, manifest version, current runtime asset/document equality, and SHA-256 checks passed |
| Installed candidate suite | Exact VSIX installed into a fresh profile; standalone copied test driver and copied Astro project ran outside the development checkout; native forms, undo, external refresh, save/preview, stop/restart, and deactivation passed |
| Actual Restricted Mode | Separate direct editor launch without the test library's trust-disabling flag verified `isTrusted=false`, content discovery, and blocked preview execution |
| Browser harness | Source Control/diff requests, content selection, typed form submissions, conflict draft retention, explicit reload, preview/retry controls, escaping, and 360px layout passed without browser exceptions; a separate keyboard check passed Tab order, Space checkbox toggle, and Enter submission |

The development editor library deliberately disables Workspace Trust. Restricted Mode was therefore tested separately rather than inferred from trusted runs. Git review uses a disposable real repository with a tracked modified file; it opens native Source Control and a `TabInputTextDiff` editor. The installed Astro case is a separate isolated project without a repository.

The VSIX contains only its manifest, compiled host/browser assets, README, changelog, user guide, third-party notices, and the two VSIX wrapper files. No development dependencies, fixtures, source maps, environment files, logs, vault pointers, or test drivers are shipped. Runtime assets are byte-compared with the verified build output.

## Release-blocker fixes

- Observed filesystem conflicts now block apply even when a dirty editor buffer has not reloaded the external saved file.
- Same-project list refresh retains entry authorization and replays refreshes arriving during the initial scan.
- Atomic-save filesystem events are coalesced before source inspection to avoid transient rename/delete diagnostics.
- The panel retains its context when hidden behind native source/diff tabs, preserving the active local draft.
- Generic editor Undo assertions wait for the observed document update instead of assuming command RPC completion is synchronous with the extension-host document event. No extra Undo operation is issued.
- Packaging accounts for vsce's normalized README/changelog filenames and verifies exact archive membership.
- Packaging dependencies pin compatible audited Azure identity/UUID versions. These development-only packages are not bundled into the extension.

## Installation and user review

```bash
code --install-extension artifacts/astro-studio-0.1.0-linux-x64.vsix
```

Open an existing Astro project and run **Astro Studio: Open Studio**. Start preview, select a supported entry, edit fields, apply, select the source editor, save, and review the native diff. Confirm that Undo and explicit conflict reload behave as expected. See [user guide](user-guide.md) for the full walkthrough and recovery behavior.

Original fixture bytes are restored after editor tests. Temporary installed profiles, copied projects, Git repositories, and browser harness processes are cleaned up. The app never automatically stages, commits, pushes, installs target dependencies, or deploys a site.

## Publication receipt

The requested source was committed and pushed to `main` at https://github.com/VJ-Ranga/astro-studio. The initial implementation commit is `1b2e9a36ff53d053991b4128bd0d16eb6a0bcd2f`; local tracking matches the remote branch.

Hosted verification was attempted at https://github.com/VJ-Ranga/astro-studio/actions/runs/40259694996. GitHub rejected runner allocation before any workflow step ran because of an owner-side account restriction. This is not a passing CI run, and no hosted artifact was produced. The owner must resolve the account restriction and rerun the workflow; local package and installed-candidate verification remain the evidence recorded above.

The verified VSIX and checksum are available locally in `artifacts/`. Human acceptance and a successful hosted CI run remain explicit follow-up gates; neither is claimed as complete.
