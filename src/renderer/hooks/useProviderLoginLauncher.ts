/**
 * useProviderLoginLauncher — one-click, app-driven provider login.
 *
 * Launches the interactive runtime login (browser OAuth) via the main process, then polls
 * auth status until the provider flips to authenticated (or a timeout). This replaces the
 * "copy this command into your terminal" flow for normal users.
 *
 * The hook builds the exact login command from the provider status (so the runtime-specific
 * args/env stay in `providerTerminalCommands`), asks the main process to open an OS console
 * running it, and then drives the existing store refresh actions on an interval.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@renderer/api';
import { getProviderTerminalCommand } from '@renderer/components/runtime/providerTerminalCommands';
import { useStore } from '@renderer/store';

import type { CliProviderId, CliProviderStatus } from '@shared/types';

export type ProviderLoginPhase =
  | 'idle'
  | 'launching'
  | 'polling'
  | 'success'
  | 'timedout'
  | 'error';

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

/** Key identifying which login flow is active. Provider logins use the providerId; the
 *  legacy single-runtime login uses this sentinel. */
export const RUNTIME_LOGIN_KEY = '__runtime__';
export type ProviderLoginKey = CliProviderId | typeof RUNTIME_LOGIN_KEY;

export interface ProviderLoginLauncher {
  phase: ProviderLoginPhase;
  /** Key of the login currently in progress (null when idle). */
  activeKey: ProviderLoginKey | null;
  /** Provider currently being logged in (null when idle or a generic runtime login). */
  activeProviderId: CliProviderId | null;
  /** Failure reason when phase === 'error'. */
  errorMessage: string | null;
  /** Whether a launch/poll is in progress (launching or polling). */
  isBusy: boolean;
  /** Launch the interactive login for the given provider (polls the provider's auth flag). */
  launchLogin: (provider: CliProviderStatus, binaryPath: string) => Promise<void>;
  /** Launch a generic runtime login (polls the overall runtime authLoggedIn flag). */
  launchRuntimeLogin: (binaryPath: string, args: string[], env?: Record<string, string>) => Promise<void>;
  /** Reset to idle (e.g. when closing a panel). */
  reset: () => void;
}

/** Reads the freshest authenticated flag for a provider directly from the store snapshot. */
function isProviderAuthenticated(providerId: CliProviderId): boolean {
  const providers = useStore.getState().cliStatus?.providers ?? [];
  return providers.some((provider) => provider.providerId === providerId && provider.authenticated);
}

/** Reads the freshest overall runtime authLoggedIn flag from the store snapshot. */
function isRuntimeAuthenticated(): boolean {
  return useStore.getState().cliStatus?.authLoggedIn === true;
}

export function useProviderLoginLauncher(): ProviderLoginLauncher {
  const [phase, setPhase] = useState<ProviderLoginPhase>('idle');
  const [activeKey, setActiveKey] = useState<ProviderLoginKey | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<CliProviderId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cancellation token — bumped on reset/unmount/new launch to stop stale poll loops.
  const runIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    clearTimer();
    setPhase('idle');
    setActiveKey(null);
    setActiveProviderId(null);
    setErrorMessage(null);
  }, [clearTimer]);

  // Stop polling if the component unmounts.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const runLaunch = useCallback(
    async (params: {
      key: ProviderLoginKey;
      providerId: CliProviderId | null;
      binaryPath: string;
      args: string[];
      env?: Record<string, string>;
      refresh: () => Promise<void>;
      isAuthenticated: () => boolean;
    }): Promise<void> => {
      const { key, providerId, binaryPath, args, env, refresh, isAuthenticated } = params;
      // Start a fresh run — invalidate any previous poll loop.
      runIdRef.current += 1;
      const runId = runIdRef.current;
      clearTimer();
      setActiveKey(key);
      setActiveProviderId(providerId);
      setErrorMessage(null);
      setPhase('launching');

      let launchError: string | null = null;
      try {
        const result = await api.cliInstaller.launchProviderLogin({
          providerId: providerId ?? 'anthropic',
          binaryPath,
          args,
          env,
        });
        if (!result.launched) {
          launchError = result.error ?? 'Login could not be launched.';
        }
      } catch (err) {
        launchError = err instanceof Error ? err.message : String(err);
      }

      // Bail if a newer run started while we were awaiting the launch.
      if (runId !== runIdRef.current) {
        return;
      }

      if (launchError) {
        setPhase('error');
        setErrorMessage(launchError);
        return;
      }

      setPhase('polling');
      const startedAt = Date.now();

      const poll = async (): Promise<void> => {
        if (runId !== runIdRef.current) return;

        try {
          await refresh();
        } catch {
          // Ignore transient refresh errors; keep polling until timeout.
        }

        if (runId !== runIdRef.current) return;

        if (isAuthenticated()) {
          setPhase('success');
          return;
        }

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setPhase('timedout');
          return;
        }

        timeoutRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      };

      timeoutRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    },
    [clearTimer]
  );

  const launchLogin = useCallback(
    async (provider: CliProviderStatus, binaryPath: string): Promise<void> => {
      const providerId = provider.providerId;
      const command = getProviderTerminalCommand(provider);
      const { invalidateCliStatus, fetchCliProviderStatus } = useStore.getState();
      await runLaunch({
        key: providerId,
        providerId,
        binaryPath,
        args: command.args,
        env: command.env,
        refresh: async () => {
          await invalidateCliStatus();
          await fetchCliProviderStatus(providerId, { verifyModels: true, silent: true });
        },
        isAuthenticated: () => isProviderAuthenticated(providerId),
      });
    },
    [runLaunch]
  );

  const launchRuntimeLogin = useCallback(
    async (binaryPath: string, args: string[], env?: Record<string, string>): Promise<void> => {
      const { invalidateCliStatus, bootstrapCliStatus } = useStore.getState();
      await runLaunch({
        key: RUNTIME_LOGIN_KEY,
        providerId: null,
        binaryPath,
        args,
        env,
        refresh: async () => {
          await invalidateCliStatus();
          await bootstrapCliStatus();
        },
        isAuthenticated: () => isRuntimeAuthenticated(),
      });
    },
    [runLaunch]
  );

  return {
    phase,
    activeKey,
    activeProviderId,
    errorMessage,
    isBusy: phase === 'launching' || phase === 'polling',
    launchLogin,
    launchRuntimeLogin,
    reset,
  };
}
