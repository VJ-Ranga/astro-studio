# Day 4 Preview Lifecycle and Recovery Implementation Plan

> Execute inline with executing-plans. The user approved Day 4. Do not delegate, commit, or push. Keep the existing Linux-first foreground dev-script scope.

**Goal:** Stop the complete owned dev-server process group on Stop, root change, and extension shutdown; prove cancellation, restart, and failure recovery without leaving live owned workers.

**Architecture:** Separate process-group lifetime from package-manager stdout/exit events. A bounded cleanup helper sends SIGTERM, checks for live group members, escalates to SIGKILL, and awaits stream closure. The dev-server controller retains ownership until cleanup is confirmed. Studio shares and awaits shutdown completion.

## Findings from the current implementation

- The close handler clears the kill timer and releases ownership when the package-manager process closes. A descendant with redirected output can survive, especially when it ignores SIGTERM.
- Unexpected package-manager exit waits for stream closure before failure handling. Descendants holding pipes can delay diagnosis and cleanup.
- Stop leaves the UI in running/starting state until closure. Cleanup needs an explicit stopping state that blocks restart and browser reopening.
- `deactivate()` returns before asynchronous process cleanup completes.
- Root switching waits for Stop but does not recheck whether the chosen root was removed during that wait before assigning it.

## Lifecycle contract

- Add `stopping` to preview states and `cleanupPending` to indicate retained ownership after a cleanup error. Start is disabled while cleanup is pending; a failed cleanup can be retried with Stop.
- `DevServerController.stop()` shares one in-flight cleanup operation. Successful Stop means no live member remains in the owned process group and the child's output streams have closed. Stop clears the URL immediately.
- Child exit and error initiate cleanup even when descendants hold streams open. Failure retains useful logs and settles startup only after cleanup finishes or a bounded cleanup error is reported.
- Send SIGTERM immediately, allow 1.5 seconds, then SIGKILL if live workers remain. Bound the final confirmation period. On Linux, distinguish live processes from zombies through `/proc` so a reaped-worker delay does not falsely indicate a running server.
- Retain ownership on cleanup failure; never launch a replacement while an old group may still be alive.
- `dispose(): Promise<void>` is idempotent. VS Code's synchronous subscription disposal initiates cleanup immediately; exported `deactivate(): Promise<void>` awaits that same operation.
- A removed root or changed selection cancels pending startup and stops the previous preview. Recheck selection membership after awaited cleanup. A cancelled picker keeps the current preview.
- Do not stop unrelated listeners or infer ownership from a port. Preserve the existing fixed-action webview protocol, trust checks, package-manager arguments, and bounded logs.

## Tasks and files

### 1. Reproduce process-lifetime failures

Update `tests/unit/dev-server.test.ts` with real subprocess regressions: a stubborn worker whose leader closes, a leader that exits while a worker holds pipes, missing executable, repeated restart, stop during startup, disposal, and unrelated-listener preservation. Tests record only their own worker PIDs and clean them in teardown even before the fix exists.

- [x] Run regression tests against Day 3 and capture expected failures.
- [x] Keep tests bounded and guarantee teardown of all fixture-created processes.

### 2. Harden process ownership and recovery

Create `src/preview/owned-process.ts`. Update `src/preview/dev-server.ts` and `src/preview/preview-types.ts`.

- [x] Implement owned process-group signalling, live-member checks, escalation, and bounded closure confirmation.
- [x] Separate child exit from final cleanup; keep ownership until confirmation.
- [x] Add stopping state, shared Stop, retryable cleanup failure, and awaited idempotent disposal.
- [x] Verify missing executable and failed script recovery without stale state, URLs, or overlapping processes.

### 3. Harden Studio coordination and UI

Update `src/extension.ts`, `webview/preview-view.tsx`, and lifecycle/rendering tests.

- [x] Verify root-switch cleanup, selected-root removal during cleanup, cancellation, and shutdown with host-boundary regressions.
- [x] Await shared preview disposal in extension deactivation; suppress callbacks after disposal.
- [x] Render stopping and retryable cleanup states with correct Start/Stop/Open availability.

### 4. Run complete acceptance checks

Extend `tests/preview/astro-preview.ts`, `tests/integration/index.ts`, and `tests/browser/panel-smoke.cjs`.

- [x] Run build, type checks, and all unit tests.
- [x] Repeat real Astro start/stop, preserve the occupied unrelated port, and verify disposal makes the final preview URL unreachable.
- [x] Verify repeated Start/Stop and awaited deactivation with a live Astro server in VS Code 1.143.1.
- [x] Verify stopping and failure/retry controls in the browser harness.
- [x] Record commands and actual results in `docs/development.md`, update README, and mark Day 4 complete only after verification.
