import { analyzeTeammateRuntimeCompatibility } from '@renderer/components/team/dialogs/teammateRuntimeCompatibility';
import { describe, expect, it } from 'vitest';

import type { TmuxStatus } from '@features/tmux-installer/contracts';

function buildTmuxStatus(ready: boolean): TmuxStatus {
  return {
    platform: 'win32',
    nativeSupported: false,
    checkedAt: '2026-04-25T00:00:00.000Z',
    host: {
      available: false,
      version: null,
      binaryPath: null,
      error: null,
    },
    effective: {
      available: ready,
      location: ready ? 'wsl' : null,
      version: ready ? '3.4' : null,
      binaryPath: ready ? '/usr/bin/tmux' : null,
      runtimeReady: ready,
      detail: ready ? 'tmux is ready' : 'tmux is not available',
    },
    error: null,
    autoInstall: {
      supported: false,
      strategy: 'manual',
      packageManagerLabel: null,
      requiresTerminalInput: false,
      requiresAdmin: false,
      requiresRestart: false,
      mayOpenExternalWindow: false,
      reasonIfUnsupported: null,
      manualHints: [],
    },
    wsl: null,
    wslPreference: null,
  };
}

const EN: Record<string, string> = {
  'runtimeCompatibility.providers.anthropic': 'Anthropic',
  'runtimeCompatibility.providers.codex': 'Codex',
  'runtimeCompatibility.providers.gemini': 'Gemini',
  'runtimeCompatibility.providers.opencode': 'OpenCode',
  'runtimeCompatibility.title.checkingTmux': 'Checking tmux runtime for explicit teammate mode',
  'runtimeCompatibility.title.openCodeLedMixed': 'OpenCode cannot lead a mixed-provider team',
  'runtimeCompatibility.title.inProcessBlocked': 'This team cannot use in-process teammates',
  'runtimeCompatibility.title.tmuxNotReady': 'tmux is not ready for explicit teammate mode',
  'runtimeCompatibility.message.checkingTmux':
    'Custom CLI args request tmux teammates. The app is checking whether tmux is available.',
  'runtimeCompatibility.message.openCodeLedMixed':
    'Right now the team lead must stay on Anthropic or Codex when teammates use different providers. OpenCode can still join as a teammate under those leads.',
  'runtimeCompatibility.message.inProcessBlocked':
    'Some teammates require separate processes. Remove --teammate-mode in-process so the app can use native process transport.',
  'runtimeCompatibility.message.tmuxNotReady':
    'Custom CLI args force --teammate-mode tmux, but tmux is not ready. Remove that arg to use native process transport on Windows, or install tmux/WSL tmux.',
  'runtimeCompatibility.details.mixedProviders': 'Mixed providers require teammate processes.',
  'runtimeCompatibility.details.mixedProvidersNamed':
    'Mixed providers: {{names}} use a different provider than the {{lead}} lead.',
  'runtimeCompatibility.details.openCodeLedMixed':
    'Mixed teams cannot use OpenCode as the lead in this phase.',
  'runtimeCompatibility.details.openCodeLedMixedNamed':
    'OpenCode-led mixed team: {{names}} use a non-OpenCode provider.',
  'runtimeCompatibility.details.codexNative':
    'Codex native teammates must run through separate Codex processes.',
  'runtimeCompatibility.details.codexNativeNamed':
    'Codex native teammates: {{names}} must run through separate Codex processes.',
  'runtimeCompatibility.details.explicitTmux': 'Custom CLI args force --teammate-mode tmux.',
  'runtimeCompatibility.details.explicitInProcess':
    'Custom CLI args force --teammate-mode in-process.',
  'runtimeCompatibility.details.fixOpenCodeLead':
    'Fix: keep the team lead on Anthropic or Codex when mixing OpenCode with other providers.',
  'runtimeCompatibility.details.fixInProcess':
    'Fix: remove --teammate-mode in-process so teammates can use native process transport.',
  'runtimeCompatibility.details.fixTmux':
    'Fix: install tmux/WSL tmux, or remove --teammate-mode tmux so the app can use native process transport.',
  'runtimeCompatibility.member.mixedProvider':
    '{{name}} uses {{provider}}. This teammate needs a separate process outside the {{lead}} lead.',
  'runtimeCompatibility.member.codexNative':
    '{{name}} uses Codex native. Codex native teammates require a separate Codex process.',
  'runtimeCompatibility.member.openCodeLedMixed':
    '{{name}} uses {{provider}}. While the lead is OpenCode, mixed providers are not supported yet — switch the lead to Anthropic or Codex, or keep every teammate on OpenCode.',
};

function t(key: string, options?: Record<string, unknown>): string {
  const template = EN[key] ?? key;
  if (!options) {
    return template;
  }
  return Object.entries(options).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    template
  );
}

describe('analyzeTeammateRuntimeCompatibility', () => {
  it('allows same-provider non-Codex teammates without tmux', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'anthropic',
      members: [{ id: 'alice', name: 'alice', providerId: 'anthropic' }],
      tmuxStatus: buildTmuxStatus(false),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.providerNoticeProviderId).toBeNull();
    expect(result.memberWarningById).toEqual({});
  });

  it('allows mixed-provider teammates through native process transport when tmux is unavailable', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'anthropic',
      members: [{ id: 'bob', name: 'bob', providerId: 'codex' }],
      tmuxStatus: buildTmuxStatus(false),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.memberWarningById).toEqual({});
  });

  it('allows OpenCode secondary-lane teammates without tmux under a non-OpenCode lead', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'anthropic',
      members: [{ id: 'bob', name: 'bob', providerId: 'opencode' }],
      tmuxStatus: buildTmuxStatus(false),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.memberWarningById).toEqual({});
  });

  it('blocks OpenCode-led mixed teams independently of tmux readiness', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'opencode',
      members: [{ id: 'bob', name: 'bob', providerId: 'anthropic' }],
      tmuxStatus: buildTmuxStatus(true),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(true);
    expect(result.providerNoticeProviderId).toBe('opencode');
    expect(result.title).toBe('OpenCode cannot lead a mixed-provider team');
    expect(result.message).toContain('Anthropic or Codex');
    expect(result.message).not.toContain('Gemini');
    expect(result.tmuxDetail).toBeNull();
    expect(result.memberWarningById.bob).toContain('mixed providers are not supported yet');
    expect(result.memberWarningById.bob).toContain('Anthropic');
  });

  it('allows same-provider Codex native teammates through native process transport when tmux is unavailable', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'codex',
      leadProviderBackendId: 'codex-native',
      members: [{ id: 'jack', name: 'jack', providerId: 'codex' }],
      tmuxStatus: buildTmuxStatus(false),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.memberWarningById).toEqual({});
  });

  it('allows separate-process teammate requirements when tmux is ready', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'anthropic',
      members: [{ id: 'bob', name: 'bob', providerId: 'codex' }],
      tmuxStatus: buildTmuxStatus(true),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(false);
    expect(result.visible).toBe(false);
  });

  it('ignores teammate runtime requirements for solo teams', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'codex',
      leadProviderBackendId: 'codex-native',
      members: [{ id: 'jack', name: 'jack', providerId: 'codex' }],
      soloTeam: true,
      tmuxStatus: buildTmuxStatus(false),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(false);
    expect(result.visible).toBe(false);
  });

  it('blocks explicit tmux teammate mode when tmux is unavailable', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'anthropic',
      members: [{ id: 'alice', name: 'alice', providerId: 'anthropic' }],
      extraCliArgs: '--teammate-mode tmux',
      tmuxStatus: buildTmuxStatus(false),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(true);
    expect(result.details).toContain('Custom CLI args force --teammate-mode tmux.');
    expect(result.message).toContain('native process transport');
  });

  it('blocks explicit in-process mode when a teammate requires a separate process', () => {
    const result = analyzeTeammateRuntimeCompatibility({
      leadProviderId: 'anthropic',
      members: [{ id: 'bob', name: 'bob', providerId: 'codex' }],
      extraCliArgs: '--teammate-mode=in-process',
      tmuxStatus: buildTmuxStatus(true),
      tmuxStatusLoading: false,
      tmuxStatusError: null,
      t,
    });

    expect(result.blocksSubmission).toBe(true);
    expect(result.title).toBe('This team cannot use in-process teammates');
    expect(result.details).toContain('Custom CLI args force --teammate-mode in-process.');
    expect(result.message).toContain('native process transport');
    expect(result.memberWarningById.bob).toContain('needs a separate process');
  });
});
