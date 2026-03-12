const fs = require('fs');
const path = require('path');

const READY_STATES = new Set(['ready', 'failed', 'disconnected', 'cancelled']);
const DEFAULT_WAIT_TIMEOUT_MS = 120000;
const MIN_WAIT_TIMEOUT_MS = 1000;
const MAX_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;
const TEAM_CONTROL_API_STATE_FILE = 'team-control-api.json';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTimeoutMs(rawValue) {
  const numeric =
    typeof rawValue === 'number' && Number.isFinite(rawValue)
      ? Math.floor(rawValue)
      : DEFAULT_WAIT_TIMEOUT_MS;
  return Math.min(MAX_WAIT_TIMEOUT_MS, Math.max(MIN_WAIT_TIMEOUT_MS, numeric));
}

function getControlApiStatePath(context) {
  return path.join(context.claudeDir, TEAM_CONTROL_API_STATE_FILE);
}

function readControlApiState(context) {
  const filePath = getControlApiStatePath(context);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()) {
      return parsed.baseUrl.trim();
    }
    return null;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function resolveControlBaseUrl(context, flags = {}) {
  const explicit =
    (typeof flags.controlUrl === 'string' && flags.controlUrl.trim()) ||
    (typeof flags['control-url'] === 'string' && flags['control-url'].trim()) ||
    (typeof process.env.CLAUDE_TEAM_CONTROL_URL === 'string' &&
      process.env.CLAUDE_TEAM_CONTROL_URL.trim()) ||
    readControlApiState(context);

  if (!explicit) {
    throw new Error(
      'Team control API is unavailable. Start the desktop app team runtime first so it can publish CLAUDE_TEAM_CONTROL_URL.'
    );
  }

  return explicit;
}

async function requestJson(baseUrl, pathname, options = {}) {
  const controller = new AbortController();
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs || 10000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: options.method || 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const detail =
        payload && typeof payload.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : `${response.status} ${response.statusText}`.trim();
      throw new Error(detail || 'Team control API request failed');
    }

    return payload;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Timed out calling team control API: ${pathname}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildLaunchRequest(flags = {}) {
  const cwd = typeof flags.cwd === 'string' ? flags.cwd.trim() : '';
  if (!cwd) {
    throw new Error('Missing cwd');
  }

  return {
    cwd,
    ...(typeof flags.prompt === 'string' && flags.prompt.trim()
      ? { prompt: flags.prompt.trim() }
      : {}),
    ...(typeof flags.model === 'string' && flags.model.trim()
      ? { model: flags.model.trim() }
      : {}),
    ...(typeof flags.effort === 'string' && flags.effort.trim()
      ? { effort: flags.effort.trim() }
      : {}),
    ...(typeof flags.clearContext === 'boolean' ? { clearContext: flags.clearContext } : {}),
    ...(typeof flags['clear-context'] === 'boolean'
      ? { clearContext: flags['clear-context'] }
      : {}),
    ...(typeof flags.skipPermissions === 'boolean'
      ? { skipPermissions: flags.skipPermissions }
      : {}),
    ...(typeof flags['skip-permissions'] === 'boolean'
      ? { skipPermissions: flags['skip-permissions'] }
      : {}),
    ...(typeof flags.worktree === 'string' && flags.worktree.trim()
      ? { worktree: flags.worktree.trim() }
      : {}),
    ...(typeof flags.extraCliArgs === 'string' && flags.extraCliArgs.trim()
      ? { extraCliArgs: flags.extraCliArgs.trim() }
      : {}),
    ...(typeof flags['extra-cli-args'] === 'string' && flags['extra-cli-args'].trim()
      ? { extraCliArgs: flags['extra-cli-args'].trim() }
      : {}),
  };
}

function shouldWaitForReady(flags = {}) {
  if (typeof flags.waitForReady === 'boolean') {
    return flags.waitForReady;
  }
  if (typeof flags['wait-for-ready'] === 'boolean') {
    return flags['wait-for-ready'];
  }
  return true;
}

function shouldWaitForStop(flags = {}) {
  if (typeof flags.waitForStop === 'boolean') {
    return flags.waitForStop;
  }
  if (typeof flags['wait-for-stop'] === 'boolean') {
    return flags['wait-for-stop'];
  }
  return true;
}

async function waitForProvisioningState(baseUrl, teamName, runId, timeoutMs) {
  const startedAt = Date.now();
  let lastProgress = null;

  while (Date.now() - startedAt <= timeoutMs) {
    const progress = await requestJson(baseUrl, `/api/teams/provisioning/${encodeURIComponent(runId)}`, {
      timeoutMs: Math.min(timeoutMs, 10000),
    });
    lastProgress = progress;

    if (progress && READY_STATES.has(progress.state)) {
      if (progress.state !== 'ready') {
        const suffix =
          progress && typeof progress.error === 'string' && progress.error.trim()
            ? `: ${progress.error.trim()}`
            : '';
        throw new Error(`Team ${teamName} did not become ready (${progress.state})${suffix}`);
      }

      return {
        teamName,
        runId,
        isAlive: true,
        progress,
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const stateLabel =
    lastProgress && typeof lastProgress.state === 'string' ? ` while in state ${lastProgress.state}` : '';
  throw new Error(`Timed out waiting for team ${teamName} to become ready${stateLabel}`);
}

async function waitForStopped(baseUrl, teamName, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const runtime = await requestJson(
      baseUrl,
      `/api/teams/${encodeURIComponent(teamName)}/runtime`,
      { timeoutMs: Math.min(timeoutMs, 10000) }
    );

    if (!runtime || runtime.isAlive !== true) {
      return runtime;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for team ${teamName} to stop`);
}

async function launchTeam(context, flags = {}) {
  const baseUrl = resolveControlBaseUrl(context, flags);
  const request = buildLaunchRequest(flags);
  const launch = await requestJson(baseUrl, `/api/teams/${encodeURIComponent(context.teamName)}/launch`, {
    method: 'POST',
    body: request,
  });

  if (!shouldWaitForReady(flags)) {
    return {
      teamName: context.teamName,
      waitForReady: false,
      ...launch,
    };
  }

  return waitForProvisioningState(
    baseUrl,
    context.teamName,
    launch.runId,
    normalizeTimeoutMs(flags.waitTimeoutMs || flags['wait-timeout-ms'])
  );
}

async function stopTeam(context, flags = {}) {
  const baseUrl = resolveControlBaseUrl(context, flags);
  const stopped = await requestJson(baseUrl, `/api/teams/${encodeURIComponent(context.teamName)}/stop`, {
    method: 'POST',
  });

  if (!shouldWaitForStop(flags)) {
    return stopped;
  }

  return waitForStopped(
    baseUrl,
    context.teamName,
    normalizeTimeoutMs(flags.waitTimeoutMs || flags['wait-timeout-ms'])
  );
}

async function getRuntimeState(context, flags = {}) {
  const baseUrl = resolveControlBaseUrl(context, flags);
  return requestJson(baseUrl, `/api/teams/${encodeURIComponent(context.teamName)}/runtime`);
}

module.exports = {
  launchTeam,
  stopTeam,
  getRuntimeState,
};
