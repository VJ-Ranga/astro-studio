# Day 1 Foundation Implementation Plan

> Execute inline using the executing-plans skill. The user approved Day 1 on 2026-10-25. Do not delegate, commit, or push without instruction.

**Goal:** Build and activate the desktop extension with three explicitly foundation-only commands and verified disposable ownership.

**Architecture:** Bundle `src/extension.ts` as CommonJS with `vscode` external. One activation controller owns an output channel and three command registrations; VS Code subscriptions and `deactivate()` dispose it idempotently. Commands report the current foundation state without reading project files or launching processes.

**Tech stack:** Node.js 22.23.1, npm 10.9.8, TypeScript 5.9.3, esbuild 0.28.2, Vitest 5.0.5, `@vscode/test-electron` 3.1.0, `@types/vscode` 1.140.0, and `@types/node` 22.20.5. Minimum declared VS Code is 1.140.0; installed verification target is 1.143.1. Exact dependencies and transitive versions are locked by npm.

## Constraints and compatibility

- Work in the existing project directory. It has no Git repository, branch, baseline application, or worktree to isolate.
- Day 2 owns discovery and the webview. Days 3–4 own actual preview processes. Day 1 command messages must not imply either is implemented.
- Official Astro installation docs and registry metadata currently require Node.js >=22.23.4 for Astro 7.4.2. The installed Node.js 22.23.1 runs the extension toolchain but is insufficient for that Astro baseline. Record this prerequisite before fixture execution; do not change the user's global Node.js installation.
- Use a separate temporary VS Code test profile. Never run integration tests against the user's normal profile.

## Task 1 — Build and test configuration

Files: `package.json`, `package-lock.json`, `tsconfig.json`, `esbuild.mjs`, `vitest.config.mts`, `.gitignore`, `.vscode/launch.json`, `.vscode/tasks.json`, `scripts/test-integration.mjs`, `tests/integration/index.ts`.

- [x] Pin dependencies and install locally with npm.
- [x] Configure `build`, `watch`, `typecheck`, `test:unit`, and `test:integration` scripts.
- [x] Bundle extension and integration test entry points with source maps; externalize `vscode`.
- [x] Configure F5 launch with a build task and compiled source maps.
- [x] Use `@vscode/test-electron` with pinned VS Code 1.143.1 or an explicitly supplied `VSCODE_EXECUTABLE_PATH` binary. Always use temporary profile directories with cleanup in `finally`.

## Task 2 — Command behavior and lifecycle

Files: `tests/unit/extension.test.ts`, `src/extension.ts`, `tests/integration/index.ts`.

Interfaces: VS Code entry points `activate(context: vscode.ExtensionContext): void` and `deactivate(): void`. Register `astroStudio.open`, `astroStudio.startPreview`, and `astroStudio.stopPreview`.

- [x] Write tests for command execution, explicit unavailable-preview messages, subscription ownership, disposal, and reactivation.
- [x] Run `npm run test:unit`; confirm missing implementation fails before adding production code.
- [x] Implement the activation controller and idempotent disposal.
- [x] Run unit tests again and require passing results.
- [x] In the real Extension Development Host, activate the extension, verify command contributions, and execute all three commands without workspace files.

## Task 3 — Verification and documentation

Files: `docs/development.md`, `README.md`, two-week delivery proposal, this checklist.

- [x] Run `npm run build`, `npm run typecheck`, `npm run test:unit`, and `npm run test:integration`. Record actual results.
- [x] Document tested versions, setup, F5 usage, honest command limitations, and Astro runtime prerequisite.
- [x] Update Day 1 checkboxes only after verification. Keep later days unchecked.

The integration runner must fail visibly if no graphical display is available. An infrastructure failure does not count as passing extension activation.
