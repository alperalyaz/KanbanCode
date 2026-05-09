# Troubleshooting

Most team issues fall into one of five buckets: runtime setup, launch confirmation, task parsing, provider limits, and review state gaps.

## Team does not launch

Check each item in order:

1. **Runtime available** — the selected CLI (`claude`, `codex`, `opencode`) is installed
2. **PATH reachable** — the binary is available in the environment `PATH`
3. **Model access** — the provider has access to the requested model string (especially for OpenCode, exact provider/model names matter)
4. **Project path** — the project directory exists and is readable
5. **Network / VPN** — some providers drop traffic when a VPN is active

### OpenCode: registered but bootstrap unconfirmed

If OpenCode shows `registered` but bootstrap is unconfirmed, inspect artifacts first before changing team prompts.

Look at the newest launch failure artifact:

```bash
~/.claude/teams/<team>/launch-failure-artifacts/latest.json
```

The manifest inside includes:

- `classification` — why the launch was considered a failure
- `bootstrapTransportBreadcrumb` — delivery path used
- Member spawn statuses
- Redacted logs and traces

Also check the lane manifest:

```bash
jq '.lanes' ~/.claude/teams/<team>/.opencode-runtime/lanes.json
jq '.activeRunId, .entries' ~/.claude/teams/<team>/.opencode-runtime/lanes/<lane>/manifest.json
```

::: tip Do not guess from the UI
Always correlate UI diagnostics with persisted files (`launch-state.json`, `bootstrap-journal.jsonl`) and runtime-specific evidence.
:::

## Agent replies are missing

Open task logs and teammate messages. Missing replies often come from:

- **Runtime delivery retry** — the agent may have answered, but the message was not delivered to the app. Check the delivery ledger.
- **Parsing or filtering** — the agent output did not include expected markers or task references.
- **Task attribution** — the work happened during the session but was not linked to the task because the correct task id was missing from the output.

::: warning Do not assume silence means ignoring
Do not assume the model ignored the message until logs confirm it.
:::

## Tasks are not linked to changes

Use task-specific logs and code review links. If a diff appears detached:

- Check whether the task id or task reference was included in the agent output.
- Verify the agent called `task_add_comment` before making edits.
- Ensure the agent called `task_start` so the board knows work began.

For OpenCode teammates, the authoritative proof that a session belongs to a task is in `opencode-sessions.json` and the lane manifest entry, not only the UI message stream.

## Rate limits

If a provider reports a known reset time, Agent Teams can nudge the lead to continue after cooldown. If reset time is unknown, wait or switch provider/runtime path.

| Provider behavior | Suggested action |
| --- | --- |
| Known reset time displayed | Wait for cooldown and continue |
| No reset time shown | Switch provider or runtime path |
| Repeated 429s | Lower concurrency or use a different model lane |

## CLI auth issues

### `claude login` not persist

If the CLI is authenticated in one terminal but the app says it is not, verify the auth is saved to the expected config path and that the app process sees the same `$HOME`.

### OpenCode provider key rejected

- Double-check the provider name in `config.json` matches the provider prefix in the model string
- Ensure the key is not expired or revoked in the provider dashboard

## Lane bootstrap stuck

For OpenCode secondary lanes:

- A missing `inboxes/<member>.json` is not automatically a bug. OpenCode lanes do not have to be primary-inbox-created before they start.
- If the UI shows the team still launching while primary members are already usable, "all teammates joined" is waiting for secondary lanes.
- If `Prepared communication channels for X/Y members` hangs, verify whether `Y` incorrectly includes secondary OpenCode members.

### Lane manifest empty entries

If the bridge says bootstrap succeeded but `manifest.json` shows `entries: []`, the issue is **evidence commit**, not model behavior. The member must not be considered deliverable until `opencode-sessions.json` and its manifest entry exist.

## When to collect evidence

Before asking for help, collect:

- Task id (short or full)
- Team name
- Runtime path (`claude`, `codex`, or `opencode`)
- Launch log excerpt (from `latest.json` or `bootstrap-journal.jsonl`)
- Provider / model string
- Exact time window when the issue occurred

This data is usually enough to debug launch and task lifecycle issues.
