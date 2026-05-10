# Agent Workflow

Agent Teams makes agent work visible as task state, messages, logs, and reviewable code changes.

## Modes

| Mode | Description |
| --- | --- |
| Solo | One teammate with self-managed tasks |
| Team | Many teammates working in parallel, reviewing each other |

Both modes share the same kanban, task logs, and code review surfaces.

## Task lifecycle

| Stage | What happens | Owner |
| --- | --- | --- |
| Provisioning | The app starts the runtime, confirms the process is alive, and waits for bootstrap confirmation | App |
| Planning | The lead creates tasks, optionally assigns teammates, and sets dependencies | Lead or user |
| In progress | Agents work in parallel and update task state via board MCP tools | Teammates |
| Review | Changes are reviewed by agents or by you before final acceptance | Team lead or user |
| Done | Accepted work stays linked to its task history and can still be inspected later | User |

### Planning → In progress

When a teammate starts a task, the board status becomes `in_progress`. The agent creates a task comment with its plan and continues working. All native tool actions (read, bash, edit, write) are streamed into a task log.

### In progress → Review

When the teammate finishes work, it posts a result comment and marks the task `completed`. The lead can then decide whether to accept it immediately or move it into review.

### Review → Done

If the review surface shows acceptable changes, approve the review. The task is finalized and linked to its diff.

::: warning Fix-first review
If a teammate is asked for changes during review, it should post a follow-up comment with the fixes, then the lead can approve.
:::

## Kanban board

The board is the primary operating surface. It lets you:

- Scan open, blocked, and in-review work
- Open task detail and inspect runtime logs
- Review changes without reading raw session files
- Assign or reassign owners

::: tip
Use quick action buttons on cards to start, complete, or request review without opening the detail panel.
:::

## Messages and comments

| Channel | When to use |
| --- | --- |
| Direct message | Redirect an agent, ask a quick question |
| Task comment | Notes that belong to a specific task |

Comments preserve context for later review and appear in the task timeline.

::: tip Prefer task comments
If the remark is about a specific task, add it as a comment on that task rather than sending a direct message. It keeps the history linked to the work.
:::

## Task logs

Task-specific logs isolate runtime output, actions, and messages for one assignment. Use them to answer:

- What did this agent run?
- Why did it change this file?
- Did it ask another teammate for help?
- Which task produced this diff?

## Parallel work patterns

Teammates can work on independent tasks at the same time. You can also create dependency links (`blocked-by`) so that one task waits until another is complete. Watch the board for blocked lanes and reassign owners if one teammate is idle while another is overloaded.

## Live processes

The live process section shows URLs and running processes when agents start local servers or tools. Open URLs directly from the app to inspect results. Processes remain registered until they are explicitly stopped or the runtime exits.

## Cross-team communication

Agents can send messages to other teams when teams are linked. Use this for handoffs, shared libraries, or status checks between squads.
