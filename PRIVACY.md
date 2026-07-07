# Privacy Policy — KanbanCode

**Last updated: 2026-07-07**

KanbanCode is a desktop application developed and maintained by **Hidroteknik**. It is **local-first**: it runs on your own computer and is designed to keep your data on your device. This policy explains what data the app touches and where it goes.

## Summary

- We do **not** operate an account system or a server that collects your projects, prompts, code, or personal data.
- Your work stays **on your device**, except where **you** choose to send it to an AI provider or where limited, anonymous, optional diagnostics apply (see below).
- There is no advertising and no selling of data.

## Data processed locally on your device

To do its job, the app reads and writes files on your own machine, including:

- Local AI tooling data under your home directory (for example `~/.claude/` session and project data);
- Files inside the project folder you select;
- The app's own settings and state.

This data is processed **locally** and is not transmitted to Hidroteknik.

## AI providers (Claude, Codex, OpenCode)

KanbanCode orchestrates AI agents using **your own** provider access (your subscriptions or API keys for Claude, Codex, or OpenCode). When you run agents, the content you give them — such as prompts, instructions, and relevant code or files — is sent **directly from your device to the AI provider you selected**, using your own credentials.

- That processing is governed by **that provider's** privacy policy and terms, not by Hidroteknik.
- Hidroteknik is not a party to, and does not receive, that content.

## Crash & performance diagnostics (optional)

Some distributed builds may include **anonymous crash and performance diagnostics** via [Sentry](https://sentry.io) to help improve stability. When this is present:

- It is **opt-out**: you can disable it in **Settings**.
- Builds compiled without a telemetry endpoint (including self-built copies) send **nothing** — diagnostics are a no-op.
- Events are **filtered/scrubbed** before sending to reduce sensitive content; they are intended to contain technical information such as error type, stack trace, app version, and operating system — not your project files, prompts, or credentials.

If you prefer, disabling the setting stops diagnostics entirely.

## Updates and runtime components

The app may contact GitHub to check for updates and to download required runtime components. These are standard network requests; as with any download, your IP address is visible to the server you connect to. Hidroteknik does not use these requests to collect personal data about you.

## Children

KanbanCode is a developer tool and is not directed to children under 13.

## Changes to this policy

We may update this policy as the app evolves. Material changes will be reflected here with a new "Last updated" date.

## Contact

Questions about this policy or your data:

- Email: **kanbancode@hidroteknik.com.tr**
- Website: https://www.hidroteknik.com.tr
- Source code: https://github.com/alperalyaz/kanbancode
