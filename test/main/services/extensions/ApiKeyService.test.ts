import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    getSelectedStorageBackend: vi.fn(() => 'basic_text'),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

import { safeStorage } from 'electron';

import { ApiKeyService } from '@main/services/extensions/apikeys/ApiKeyService';

describe('ApiKeyService', () => {
  let tempDir: string;
  let service: ApiKeyService;

  beforeEach(async () => {
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue('basic_text');
    vi.mocked(safeStorage.encryptString).mockReset();
    vi.mocked(safeStorage.decryptString).mockReset();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apikey-service-'));
    service = new ApiKeyService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('persists projectPath for project-scoped API keys', async () => {
    const saved = await service.save({
      name: 'Project Tavily',
      envVarName: 'TAVILY_API_KEY',
      value: 'secret',
      scope: 'project',
      projectPath: '/tmp/project-a',
    });

    expect(saved.scope).toBe('project');
    expect(saved.projectPath).toBe('/tmp/project-a');

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        scope: 'project',
        projectPath: '/tmp/project-a',
      }),
    ]);
  });

  it('rejects project-scoped keys without a project path', async () => {
    await expect(
      service.save({
        name: 'Broken key',
        envVarName: 'TAVILY_API_KEY',
        value: 'secret',
        scope: 'project',
      })
    ).rejects.toThrow('project path');
  });

  it('prefers exact project matches over user keys during lookup', async () => {
    await service.save({
      name: 'Shared Tavily',
      envVarName: 'TAVILY_API_KEY',
      value: 'user-secret',
      scope: 'user',
    });
    await service.save({
      name: 'Project Tavily',
      envVarName: 'TAVILY_API_KEY',
      value: 'project-secret',
      scope: 'project',
      projectPath: '/tmp/project-a',
    });

    await expect(service.lookup(['TAVILY_API_KEY'], '/tmp/project-a')).resolves.toEqual([
      {
        envVarName: 'TAVILY_API_KEY',
        value: 'project-secret',
      },
    ]);
  });

  it('falls back to user keys when project-specific matches do not exist', async () => {
    await service.save({
      name: 'Shared Tavily',
      envVarName: 'TAVILY_API_KEY',
      value: 'user-secret',
      scope: 'user',
    });
    await service.save({
      name: 'Other project Tavily',
      envVarName: 'TAVILY_API_KEY',
      value: 'project-secret',
      scope: 'project',
      projectPath: '/tmp/project-b',
    });

    await expect(service.lookup(['TAVILY_API_KEY'], '/tmp/project-a')).resolves.toEqual([
      {
        envVarName: 'TAVILY_API_KEY',
        value: 'user-secret',
      },
    ]);
  });

  it('does not leak project-scoped keys without project context', async () => {
    await service.save({
      name: 'Project only key',
      envVarName: 'TAVILY_API_KEY',
      value: 'project-secret',
      scope: 'project',
      projectPath: '/tmp/project-a',
    });

    await expect(service.lookup(['TAVILY_API_KEY'])).resolves.toEqual([]);
    await expect(service.lookupPreferred('TAVILY_API_KEY')).resolves.toBeNull();
  });

  it('does not print decrypt failures to the normal console', async () => {
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
    vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue('gnome_libsecret');
    vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('encrypted-value'));
    vi.mocked(safeStorage.decryptString).mockImplementation(() => {
      throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.');
    });

    await service.save({
      name: 'Anthropic API Key',
      envVarName: 'ANTHROPIC_API_KEY',
      value: 'secret',
      scope: 'user',
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(service.lookupPreferred('ANTHROPIC_API_KEY')).resolves.toEqual({
        envVarName: 'ANTHROPIC_API_KEY',
        value: '',
      });
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });
});
