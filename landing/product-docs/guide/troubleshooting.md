# Troubleshooting

Most team issues fall into one of four buckets: runtime setup, launch confirmation, task parsing, or provider limits.

## Team does not launch

Check:

- The selected runtime is installed or authenticated
- The runtime is available in the environment `PATH`
- The provider has access to the requested model
- The project path exists and is readable

::: tip
Run the runtime binary directly in a terminal to verify it is on PATH and authenticated. For example: `claude --version` or `opencode --version`.
:::

### OpenCode bootstrap unconfirmed

If OpenCode shows `registered` but bootstrap is unconfirmed:

1. Inspect the launch logs in the UI.
2. Check `~/.claude/teams/<team>/launch-state.json` for the member state.
3. Look at `~/.claude/teams/<team>/.opencode-runtime/lanes/<lane-id>/manifest.json` for evidence.
4. Do not change team prompts until you confirm whether the lane started but failed to commit evidence.

::: warning
A missing OpenCode inbox during primary launch is normal. Secondary lanes start after primary filesystem readiness. Do not treat primary hang as an OpenCode bug unless the UI explicitly shows `Y` members waiting with `Y` incorrectly including OpenCode lanes.
:::

## Agent replies are missing

Open task logs and teammate messages. Missing replies often come from:

- Runtime delivery gaps
- Parsing or task filtering issues
- The agent is still processing (large tasks may take minutes)

Do not assume the model ignored the message until logs confirm it.

::: tip
For OpenCode teammates, check that `agent-teams_message_send` was called with the correct `from`, `to`, and `taskRefs`. OpenCode replies must be sent via MCP tools, not plain text.
:::

## Tasks are not linked to changes

Use task-specific logs and code review links. If a diff appears detached:

- Check whether the task id or task reference was included in the agent output.
- Verify the agent called `task_add_comment` before making edits.
- Ensure the agent called `task_start` so the board knows work began.

## Rate limits

If a provider reports a known reset time, Agent Teams can nudge the lead to continue after cooldown. If reset time is unknown, wait or switch provider/runtime path.

## Common member states

| State | Meaning |
|-------|---------|
| `confirmed_alive` + `bootstrapConfirmed` | Healthy and usable |
| `registered` / `runtime_pending_bootstrap` | Process or lane exists, but bootstrap proof is not committed yet |
| `failed_to_start` + `runtime_process` | A process exists but the launch gate failed. Inspect diagnostics |
| `failed_to_start` + `stale_metadata` | Persisted pid/session is old or dead |

::: warning
`member_briefing` alone is NOT runtime evidence. For OpenCode, the authoritative proof is committed runtime evidence such as `opencode-sessions.json` and its manifest entry.
:::

## Teammate runtime debug mode

For local debugging, you can force pane-backed teammates through `tmux`:

```bash
# Terminal launch
CLAUDE_TEAM_TEAMMATE_MODE=tmux pnpm dev

# Or add to custom CLI args
--teammate-mode tmux
```

Use this to inspect interactive CLI behavior. Do not treat it as equivalent to the process backend for recovery semantics.

## CLI auth diagnostic

Each run of `CliInstallerService.getStatus()` appends one line to `claude-cli-auth-diag.ndjson` inside the Electron logs folder (typically `~/Library/Logs/<product-name>/` on macOS). If the file exceeds **512 KiB**, it is truncated to empty before the next append.

Check this file if you see "Not logged in" or authentication errors in the packaged app.

## Safe cleanup

When cleaning up stale processes:

1. Identify the pid and confirm it belongs to the current team/lane.
2. Stop only processes explicitly owned by the smoke test or the launch you are debugging.
3. Do **not** kill all OpenCode processes or shared hosts as a shortcut.

## When to collect evidence

Collect:

- Task id
- Team name
- Runtime path
- Launch log excerpt
- Provider/model
- Exact time window

This is enough to debug most launch and task lifecycle issues.

::: tip
If the problem persists, open the team's persisted files under `~/.claude/teams/<teamName>/` and correlate UI diagnostics with live process state before changing code.
:::
