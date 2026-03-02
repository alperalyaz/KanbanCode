/**
 * Vitest setup file.
 * Runs before each test file.
 */

import { afterEach, beforeEach, expect, vi } from 'vitest';

// Mock process.env for tests that need home directory.
// Use Proxy so process keeps all methods (listeners, on, etc.) — spreading loses them.
const testEnv = { ...process.env, HOME: '/home/testuser' };
vi.stubGlobal(
  'process',
  new Proxy(process, {
    get(target, prop) {
      if (prop === 'env') return testEnv;
      return (target as Record<string | symbol, unknown>)[prop];
    },
  })
);

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

function formatConsoleCall(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return arg.message;
      }
      return String(arg);
    })
    .join(' ');
}

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  const unexpectedErrors = errorSpy.mock.calls.map(formatConsoleCall);
  const unexpectedWarnings = warnSpy.mock.calls.map(formatConsoleCall);

  errorSpy.mockRestore();
  warnSpy.mockRestore();

  expect(unexpectedErrors, `Unexpected console.error calls:\n${unexpectedErrors.join('\n')}`).toEqual(
    []
  );
  expect(
    unexpectedWarnings,
    `Unexpected console.warn calls:\n${unexpectedWarnings.join('\n')}`
  ).toEqual([]);
});
