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
