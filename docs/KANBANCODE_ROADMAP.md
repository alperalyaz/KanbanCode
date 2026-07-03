# KanbanCode — Simplification Roadmap & Session Handoff

> Living handoff document. Any session (local or cloud) continuing the KanbanCode
> work should read this first, and update it when status or decisions change.

## Goal

Fork of "Agent Teams AI" being turned into **KanbanCode**: a light, simple,
"less is more" multi-agent kanban app, published **free on the Microsoft Store**,
source public on GitHub, with credits to the upstream project.

Core to keep: team creation + agent process management + kanban board + messaging (DM/inbox).

## Decisions (owner: Alper, 2026-07-02)

| Topic | Decision |
|---|---|
| Runtimes | Keep all three (Claude + Codex + OpenCode) — MCP bridge stays |
| Terminal stack | **Remove** (node-pty, xterm, ssh2, terminal-platform) — RAM + MSIX certification win |
| Code review | Remove **diff-viewer UI only**; keep review/approved kanban columns and review state machine (full removal breaks the board) |
| Branching | Single branch: `main`. No feature branches. |
| License | Upstream is **AGPL-3.0** → KanbanCode stays AGPL, source stays public (already planned). Credits alone are not sufficient. |

## Phase plan (corrected order after plan critique)

1. **Stabilization** — typecheck green ✅, test suite triaged (in progress)
2. **Perf diagnosis & pruning** — profile with 3 agents on Windows, then cut the culprits.
   Prime suspects (evidence-based):
   - `src/main/services/team/TeamProvisioningService.ts` (~39k-line monolith): multiple `setInterval`s + `pidusage` polling → falls back to WMI on Windows → likely #1 CPU killer
   - `src/main/services/infrastructure/FileWatcher.ts`: recursive `fs.watch` + catch-up polling; its own comments admit NTFS thread-pool exhaustion
   - 15+ active `setInterval`s across main services (BranchStatusService, TeamDataService processHealth, TeamBackupService, DataCache, EventLoopLagMonitor, …)
   - ⚠️ Windows-specific: profiling must happen on a Windows machine, not in cloud sandboxes
3. **Feature pruning** — highest yield first: terminal stack (node-pty/xterm/ssh2), then review diff-viewer UI (~26 files under `src/renderer/components/team/review/` — keep `changeReviewSlice` task-presence logic that feeds kanban badges), then candidates pending approval: organizations, schedules, extensions/skills UI, session-analysis panels
4. **Cosmetics** — replace robot avatars (`agentAvatarUrl`) with simple initial badges; calm the color scheme; delete leftover locale JSON (locales already reduced to en+tr in `src/features/localization/contracts/appLocale.ts`)
5. **Rebrand** — `package.json` author/name, mac/linux `artifactName` still `Agent.Teams.AI*`, remove/replace Sentry (currently would report to upstream's DSN), credits screen, LICENSE/README attribution
6. **Microsoft Store** — MSIX via electron-builder `appx` target (config exists; `publisher`/`identityName` must match Partner Center exactly), disable electron-updater in Store builds (Store updates itself), test packaged-app CLI spawn (`~/.claude` access, see "Packaged app: CLI / Not logged in" in CLAUDE.md)

## Status log

- **2026-07-03 (cloud session)** — **Phase 4 cosmetics batch (owner requests).**
  (1) Animated splash "teams scene" removed entirely — `splashScene.ts` (1015 lines) deleted,
  the ~900-line inline canvas copy stripped from `index.html`, artificial splash hold times
  dropped (min 1600ms → 300ms); splash is now logo + name + progress bar + status/elapsed +
  error timeline only. (2) New "K" brand mark: splash SVG + full icon set regenerated
  programmatically (Pillow) — `resources/icon.png`, `icons/png/16..1024`, `win/icon.ico`
  (7 sizes), `mac/icon.icns`, renderer `favicon.png`, master in `icons/source/`.
  (3) Discord button removed from the tab bar. (4) Right sidebar (tasks/sessions) now
  defaults to collapsed (`uiSlice.sidebarCollapsed: true`). (5) Windows administrator
  banner now renders only when the OpenCode runtime is actually installed (+ test).
  README header image `docs/assets/github-header-kanbancode.png` NOT regenerated — needs
  a proper banner design, still shows old branding.

- **2026-07-03 (cloud session)** — **Phase 2 quick wins: background poll gating.**
  New `src/main/utils/windowVisibility.ts` tracks whether the main window is visible
  (minimize/hide aware; blur intentionally ignored; defaults to "active" in
  standalone/tests). Gated pollers now skip their tick while the window is hidden:
  `TeamDataService.processHealthTick` (also relaxed 2s → 5s — each tick reads and
  sometimes rewrites `processes.json` per tracked team), `BranchStatusService`
  (20s git probes), renderer `useTeamAgentRuntimeWatcher` (CPU/RAM member telemetry —
  also refreshes immediately on visibilitychange), `useCodexAccountSnapshot`,
  `useOrganizationMap`. **Intentionally NOT gated:** file watchers and task/inbox
  monitoring — task-completion and attention notifications must keep working while
  minimized. Known trade-off: while hidden, dead agent processes are marked
  `stoppedAt` up to one poll late. Typecheck green; TeamDataService (124),
  BranchStatusService, and watcher tests pass. Remaining phase-2 candidates (need
  Windows profiling first): pidusage WMI cost on Windows, FileWatcher NTFS scope,
  TeamProvisioningService intervals.

- **2026-07-03 (cloud session)** — **Phase 3: embedded terminal stack fully removed.**
  Deleted: `src/features/terminal-workspace/`, `PtyTerminalService` + `ipc/terminal`,
  SSH stack (`SshConnectionManager`/`SshFileSystemProvider`/`SshConfigParser`, `ipc/ssh`,
  `http/ssh`, Connection/Workspace settings sections, `connectionSlice`), `EmbeddedTerminal`,
  `vendor/terminal-platform/` + staging scripts + lockfile, and the `node-pty`/`@xterm/*`/`ssh2`/
  `@terminal-platform/*` dependencies (postinstall no longer runs electron-rebuild).
  Kept: `TerminalLogPanel` (rewritten as dependency-free ANSI-stripping log pane) and
  `TerminalModal` (rewritten as copy-the-command dialog, same props) so CLI-installer/login
  consumers compile unchanged; tmux-installer / workspace-trust / ClaudeDoctorProbe keep their
  graceful no-pty degradation via local `@shared/types/optionalPty` types. Dead i18n groups
  pruned (`common.terminal`, `settings.connection`, `settings.workspaceProfiles`,
  `team.terminalWorkspace`) from en+tr and `resources.d.ts` — re-run `pnpm i18n:extract`+
  `i18n:types` locally to confirm. **Verification (cloud, Node 24.15.0):** `pnpm typecheck`
  green; vitest 7700 passed / 85 failed — 62 failing suites are electron-binary-missing
  (sandbox installed with `--ignore-scripts`; fine on real machines), remaining 7 failures
  reproduce identically on the pre-removal commit (pre-existing triage backlog: model-catalog
  label drift + graph-tab throttle tests + userData migration). Zero new regressions from the
  removal. `pnpm-lock.yaml` regenerated without the removed deps. Follow-ups: run full suite
  on Windows, `pnpm i18n:extract`, and knip for any now-unused exports.

- **2026-07-02 (cloud session)** — Phase 5 rebrand sweep: `package.json` name → `kanbancode`,
  author → Hidroteknik; mac/dmg/AppImage `artifactName` → `KanbanCode-*`; linux launcher
  `resources/linux/bin/agent-teams-ai` → `kanbancode` (fpm mappings updated, `/opt/KanbanCode`);
  updater repo/asset expectations → `alperalyaz/kanbancode` + `KanbanCode-*` (legacy fallback:
  `agent-teams-ai`); Sentry release prefix → `kanbancode@`. **Sentry finding:** DSN is injected at
  build time from `SENTRY_DSN` env (upstream CI secret) — local/Store builds compile with an empty
  DSN, so Sentry is already a no-op; full package removal can wait for the pruning phase.
  Not touched: `.github/workflows/release.yml` (upstream CI, needs its own pass if fork ever uses it).

- **2026-07-02** — Built-in code editor and team-graph visualization removed (commit `4359e7b6` + earlier commits). Typecheck green after cleaning ~250 leftover errors (orphaned tests deleted, preload/MarkdownViewer/MemberBadge/KanbanTaskCard fixes). i18n types regenerated. Branch `claude/agent-teams-ai-overview-f8n3rm` merged into `main` and deleted; all work now on `main`.
- **2026-07-02** — Full vitest suite after clean install: 9219 passed / 50 failed / 69 skipped. Known local-machine quirks: `node_modules/.bin` can end up empty → run tools via `node node_modules/vitest/vitest.mjs run`; a stale process once locked `node-pty` and broke `pnpm install`.
- **2026-07-02** — Test triage done. Fixed the removal-related failures: 19 orphaned graph-layout tests deleted from `teamSlice.test.ts`, `AttachmentDisplay.test` rewritten for the no-editor behavior, `KanbanTaskCard` pulse test no longer depends on the removed `memberColorMap` prop identity. Remaining ~25 failures are **pre-existing upstream Windows path-normalization bugs** (drive-letter prefixes, hardcoded `\Users\belief\...` author paths) in Codex/model-catalog/trust/live-smoke tests, plus terminal-workspace tests that disappear with the terminal removal. They are not regressions; fix or prune separately.

## Working agreements

- Always `pnpm` (not npm/yarn). Pipe long outputs through `tail -20`.
- Editing/removing i18n keys requires `pnpm i18n:types` + tests (typecheck alone gives false green).
- Commits: human-readable messages, no tool-attribution trailers. Stage by explicit path, never `git add -A`.
- Pull before starting work — local and cloud sessions share `main`.
