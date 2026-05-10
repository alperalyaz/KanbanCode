import { describe, expect, test } from 'vitest';

import { ClaudeMultimodelBridgeService } from './ClaudeMultimodelBridgeService';

import type { CliProviderId, CliProviderStatus } from '@shared/types';

interface RuntimeStatusMapper {
  mapRuntimeProviderStatus: (
    providerId: CliProviderId,
    runtimeStatus: unknown
  ) => CliProviderStatus;
}

function mapRuntimeProviderStatus(
  providerId: CliProviderId,
  runtimeStatus: unknown
): CliProviderStatus {
  const service = new ClaudeMultimodelBridgeService() as unknown as RuntimeStatusMapper;
  return service.mapRuntimeProviderStatus(providerId, runtimeStatus);
}

describe('ClaudeMultimodelBridgeService runtime status mapping', () => {
  test('maps Anthropic subscription rate limits from orchestrator runtime status', () => {
    const provider = mapRuntimeProviderStatus('anthropic', {
      supported: true,
      authenticated: true,
      authMethod: 'claude.ai',
      verificationState: 'verified',
      canLoginFromUi: true,
      models: ['haiku'],
      capabilities: {
        teamLaunch: true,
        oneShot: true,
      },
      subscriptionRateLimits: {
        primary: {
          usedPercent: 42.5,
          windowDurationMins: 300,
          resetsAt: 1_777_777_000,
        },
        secondary: {
          usedPercent: 150,
          windowDurationMins: Number.NaN,
          resetsAt: Number.NaN,
        },
      },
    });

    expect(provider.subscriptionRateLimits).toEqual({
      primary: {
        usedPercent: 42.5,
        windowDurationMins: 300,
        resetsAt: 1_777_777_000,
      },
      secondary: {
        usedPercent: 100,
        windowDurationMins: null,
        resetsAt: null,
      },
    });
  });

  test('drops malformed Anthropic subscription rate limit windows', () => {
    const provider = mapRuntimeProviderStatus('anthropic', {
      supported: true,
      authenticated: true,
      authMethod: 'claude.ai',
      verificationState: 'verified',
      subscriptionRateLimits: {
        primary: {
          usedPercent: Number.NaN,
          windowDurationMins: 300,
          resetsAt: 1_777_777_000,
        },
        secondary: {
          usedPercent: 60,
          windowDurationMins: 10_080,
          resetsAt: 1_777_999_000,
        },
      },
    });

    expect(provider.subscriptionRateLimits).toEqual({
      primary: null,
      secondary: {
        usedPercent: 60,
        windowDurationMins: 10_080,
        resetsAt: 1_777_999_000,
      },
    });
  });

  test('ignores subscription rate limits for non-Anthropic providers', () => {
    const provider = mapRuntimeProviderStatus('codex', {
      supported: true,
      authenticated: true,
      authMethod: 'oauth_token',
      verificationState: 'verified',
      subscriptionRateLimits: {
        primary: {
          usedPercent: 25,
          windowDurationMins: 300,
          resetsAt: 1_777_777_000,
        },
      },
    });

    expect(provider.subscriptionRateLimits).toBeNull();
  });

  test('ignores Anthropic subscription rate limits for API key auth', () => {
    const provider = mapRuntimeProviderStatus('anthropic', {
      supported: true,
      authenticated: true,
      authMethod: 'api_key',
      verificationState: 'verified',
      subscriptionRateLimits: {
        primary: {
          usedPercent: 25,
          windowDurationMins: 300,
          resetsAt: 1_777_777_000,
        },
      },
    });

    expect(provider.subscriptionRateLimits).toBeNull();
  });
});
