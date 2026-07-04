import { describe, expect, it } from 'vitest';

import { launchProviderLoginConsole } from './launchProviderLoginConsole';

describe('launchProviderLoginConsole', () => {
  it('never throws and reports not-launched when the binary path is empty', async () => {
    const result = await launchProviderLoginConsole('', ['auth', 'login']);
    expect(result.launched).toBe(false);
    expect(result.method).toBe('none');
    expect(result.error).toContain('not found');
  });

  it('reports not-launched when the binary path does not exist', async () => {
    const result = await launchProviderLoginConsole(
      '/definitely/not/a/real/binary-xyz',
      ['auth', 'login', '--provider', 'anthropic'],
      { SOME_ENV: 'value' }
    );
    expect(result.launched).toBe(false);
    expect(result.error).toBeDefined();
  });
});
