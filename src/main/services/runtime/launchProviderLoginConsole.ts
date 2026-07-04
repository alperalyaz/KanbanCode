/**
 * launchProviderLoginConsole — spawns the interactive runtime provider-login flow in a
 * real OS console so the browser OAuth (`/login`) step can complete, WITHOUT node-pty or
 * any native module.
 *
 * Per-OS strategy (see docs in README / task notes):
 * - Windows: write a temp .bat that sets env + runs the binary, then open it in a new
 *   console window via `cmd.exe /c start "" <bat>`. The batch keeps the window open with
 *   `pause` so the user can read any printed URL/status.
 * - macOS: write a temp .command script (chmod +x) and open it with the Terminal app via
 *   `open -a Terminal <script>`.
 * - Linux: write a temp .sh script and try a common terminal emulator (gnome-terminal,
 *   konsole, xterm, x-terminal-emulator, …). If none is found, fall back to launching the
 *   binary directly detached — most runtime logins open the browser themselves.
 *
 * The runtime login (Claude Code style OAuth) typically opens the browser on its own; the
 * console is there so a printed fallback URL is visible if it does not. This function never
 * throws — it returns a structured result describing whether a process was launched.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod,mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { getErrorMessage } from '@shared/utils/errorHandling';
import { createLogger } from '@shared/utils/logger';

import type { CliProviderLoginLaunchResult } from '@shared/types';

const logger = createLogger('runtime:launchProviderLoginConsole');

/** Terminal emulators tried on Linux, in preference order. Each takes `-e <cmd...>`. */
const LINUX_TERMINALS: readonly string[] = [
  'x-terminal-emulator',
  'gnome-terminal',
  'konsole',
  'xfce4-terminal',
  'kitty',
  'alacritty',
  'xterm',
];

/** Quote a value for a POSIX single-quoted string. */
function posixSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Build the POSIX shell script body (macOS/Linux). */
function buildUnixScript(binaryPath: string, args: string[], env: Record<string, string>): string {
  const lines = ['#!/bin/sh', 'set -e'];
  for (const [key, rawValue] of Object.entries(env)) {
    // Only allow safe env var names; skip anything odd defensively.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    lines.push(`export ${key}=${posixSingleQuote(rawValue)}`);
  }
  const command = [binaryPath, ...args].map(posixSingleQuote).join(' ');
  lines.push(command);
  lines.push('echo ""');
  lines.push('echo "Bu pencereyi kapatabilirsiniz. / You can close this window."');
  return `${lines.join('\n')}\n`;
}

/** Escape a value for a Windows batch `set "KEY=VALUE"` line. */
function batchEnvValue(value: string): string {
  return value.replace(/%/g, '%%').replace(/"/g, '');
}

/** Quote a Windows argument (batch). */
function batchArg(value: string): string {
  return `"${value.replace(/"/g, '')}"`;
}

/** Build the Windows batch script body. */
function buildWindowsScript(
  binaryPath: string,
  args: string[],
  env: Record<string, string>
): string {
  const lines = ['@echo off'];
  for (const [key, rawValue] of Object.entries(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    lines.push(`set "${key}=${batchEnvValue(rawValue)}"`);
  }
  const command = [binaryPath, ...args].map(batchArg).join(' ');
  lines.push(command);
  lines.push('echo.');
  lines.push('echo Bu pencereyi kapatabilirsiniz. / You can close this window.');
  lines.push('pause');
  return `${lines.join('\r\n')}\r\n`;
}

async function writeTempScript(fileName: string, contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'kanban-login-'));
  const scriptPath = path.join(dir, fileName);
  await writeFile(scriptPath, contents, 'utf8');
  return scriptPath;
}

function launched(method: string): CliProviderLoginLaunchResult {
  return { launched: true, method };
}

function failed(method: string, error: string): CliProviderLoginLaunchResult {
  return { launched: false, method, error };
}

async function launchWindows(
  binaryPath: string,
  args: string[],
  env: Record<string, string>
): Promise<CliProviderLoginLaunchResult> {
  const script = buildWindowsScript(binaryPath, args, env);
  const scriptPath = await writeTempScript('provider-login.bat', script);
  // `start "" <bat>` opens a NEW console window and runs the batch. Empty "" is the window
  // title (required so a quoted path is not mistaken for the title). detached + no windowHide
  // so the console is actually visible to the user.
  const child = spawn('cmd.exe', ['/c', 'start', '""', scriptPath], {
    windowsHide: false,
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', (err) => logger.error('Windows login console spawn error:', getErrorMessage(err)));
  child.unref();
  return launched('windows-console');
}

async function launchMac(
  binaryPath: string,
  args: string[],
  env: Record<string, string>
): Promise<CliProviderLoginLaunchResult> {
  const script = buildUnixScript(binaryPath, args, env);
  const scriptPath = await writeTempScript('provider-login.command', script);
  await chmod(scriptPath, 0o755);
  // `open -a Terminal <script>` opens Terminal.app and runs the executable script.
  const child = spawn('open', ['-a', 'Terminal', scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', (err) => logger.error('macOS Terminal spawn error:', getErrorMessage(err)));
  child.unref();
  return launched('macos-terminal');
}

function commandExists(command: string): boolean {
  // Resolve against PATH by attempting a lightweight `which`-style check.
  const pathEnv = process.env.PATH ?? '';
  const separator = process.platform === 'win32' ? ';' : ':';
  return pathEnv
    .split(separator)
    .some((dir) => dir && existsSync(path.join(dir, command)));
}

function spawnLinuxTerminal(
  terminal: string,
  scriptPath: string
): CliProviderLoginLaunchResult | null {
  try {
    const args =
      terminal === 'gnome-terminal'
        ? ['--', 'sh', scriptPath]
        : ['-e', `sh ${posixSingleQuote(scriptPath)}`];
    const child = spawn(terminal, args, { detached: true, stdio: 'ignore' });
    child.on('error', (err) =>
      logger.error(`Linux terminal (${terminal}) spawn error:`, getErrorMessage(err))
    );
    child.unref();
    return launched(`linux-${terminal}`);
  } catch (err) {
    logger.warn(`Failed to launch ${terminal}: ${getErrorMessage(err)}`);
    return null;
  }
}

async function launchLinux(
  binaryPath: string,
  args: string[],
  env: Record<string, string>
): Promise<CliProviderLoginLaunchResult> {
  const script = buildUnixScript(binaryPath, args, env);
  const scriptPath = await writeTempScript('provider-login.sh', script);
  await chmod(scriptPath, 0o755);

  for (const terminal of LINUX_TERMINALS) {
    if (!commandExists(terminal)) continue;
    const result = spawnLinuxTerminal(terminal, scriptPath);
    if (result) return result;
  }

  // No terminal emulator available — fall back to launching the binary directly. Most
  // runtime logins open the browser themselves; without a console we cannot show a URL.
  try {
    const child = spawn(binaryPath, args, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ...env },
    });
    child.on('error', (err) =>
      logger.error('Linux direct login spawn error:', getErrorMessage(err))
    );
    child.unref();
    return launched('direct');
  } catch (err) {
    return failed('direct', getErrorMessage(err));
  }
}

/**
 * Launch the interactive provider login. Never throws.
 */
export async function launchProviderLoginConsole(
  binaryPath: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<CliProviderLoginLaunchResult> {
  try {
    if (!binaryPath || !existsSync(binaryPath)) {
      return failed('none', `Runtime binary not found: ${binaryPath || '(empty)'}`);
    }

    switch (process.platform) {
      case 'win32':
        return await launchWindows(binaryPath, args, env);
      case 'darwin':
        return await launchMac(binaryPath, args, env);
      default:
        return await launchLinux(binaryPath, args, env);
    }
  } catch (err) {
    const message = getErrorMessage(err);
    logger.error('launchProviderLoginConsole failed:', message);
    return failed('none', message);
  }
}
