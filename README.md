# KanbanCode

<p>
  <a href="https://github.com/alperalyaz/kanbancode/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square" alt="AGPL-3.0 License" /></a>
</p>

A desktop app for orchestrating AI agent teams across Claude, Codex, and OpenCode. You assign work, agents run in parallel on a kanban board, and you review their changes — all local-first.

Developed and maintained by **[Hidroteknik](https://www.hidroteknik.com.tr)**.

## This is a fork

KanbanCode is a fork of [Agent Teams AI](https://github.com/777genius/agent-teams-ai) by **777genius**, distributed under the same [AGPL-3.0](LICENSE) license. Credit for the original design and implementation goes to the upstream project and its contributors.

- Upstream project: https://github.com/777genius/agent-teams-ai
- This fork: https://github.com/alperalyaz/kanbancode
- File bugs, feature requests, and questions about this fork against **this** repository, not the upstream one.

## What it does

- Assemble agent teams with roles that work autonomously in parallel across Claude, Codex, and OpenCode
- Manage everything from a kanban board — tasks move between TODO / IN PROGRESS / DONE as agents work
- Review each task's code changes and approve, reject, or comment
- Message any agent directly, comment on tasks, and watch live process/runtime activity
- Solo mode (a single self-managing agent) or full multi-agent teams
- Local-first: uses the Claude/Codex/OpenCode provider access you already have, with a built-in MCP server for external tools

## Development

**Prerequisites:** Node.js 24.15.0+ (below 25), pnpm 10+

```bash
git clone https://github.com/alperalyaz/kanbancode.git
cd kanbancode
pnpm install
pnpm dev
```

`pnpm dev` starts the desktop Electron app with hot reload. The desktop app is the supported way to run agent teams; the browser/web path is limited and not intended for normal use.

Repo working instructions live in [CLAUDE.md](CLAUDE.md).

### Scripts

| Command            | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `pnpm dev`         | Desktop app development with hot reload                 |
| `pnpm build`       | Production build                                        |
| `pnpm typecheck`   | TypeScript type checking                                |
| `pnpm lint`        | Lint (no auto-fix)                                      |
| `pnpm test`        | Run all tests                                           |
| `pnpm check`       | Full quality gate (types + lint + test + build)         |
| `pnpm dist:win`    | Build Windows installer (`.exe` + `.appx`) locally      |
| `pnpm dist:mac:arm64` | Build macOS (Apple Silicon) `.dmg`                   |
| `pnpm dist:mac:x64`   | Build macOS (Intel) `.dmg`                           |
| `pnpm dist:linux`  | Build Linux `.AppImage` / `.deb` / `.rpm` / `.pacman`   |

### GitHub Actions release (recommended)

You do **not** need a local Windows machine to ship Store/installer builds.

1. Open **Actions → Release → Run workflow**.
2. Leave `release_tag` **empty** — it uses the version in `package.json` automatically (currently `2.1.5` → tag `v2.1.5`).
3. Leave `publish_release` as `false` for a draft, or set `true` to publish immediately.
4. When the run finishes, the draft/public GitHub Release contains:
   - `KanbanCode.Setup.<version>.exe` — sideload / direct install
   - `KanbanCode.<version>.appx` — upload to Microsoft Partner Center (Store)

The workflow downloads the bundled agent runtime from the public upstream tag pinned in `runtime.lock.json`, packages both Windows targets with electron-builder, and uploads the artifacts. Partner Center re-signs the `.appx` for Store distribution.

## Security

IPC and standalone HTTP handlers validate IDs, paths, and payload shape at the boundary. Write operations are constrained to the selected project root; read-only discovery also accesses local Claude data under `~/.claude/`. See [SECURITY.md](.github/SECURITY.md) and report vulnerabilities against this repository.

## Contact

- Project lead: **Alper Alyaz**
- Website: https://www.hidroteknik.com.tr
- Email: kanbancode@hidroteknik.com.tr

## License

[AGPL-3.0](LICENSE) — the same license as the upstream project. Original copyright: 777genius. This fork's changes are licensed under the same terms. Because of AGPL-3.0, if you distribute this app or offer it to others over a network, you must make the corresponding source code available under the same license.
