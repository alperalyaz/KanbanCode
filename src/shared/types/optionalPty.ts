/**
 * Minimal structural types for the optional `node-pty` native addon.
 *
 * The dependency itself was removed from the app (embedded terminal stack
 * pruning); consumers keep a graceful `require('node-pty')` that fails and
 * degrades. These local types replace the removed `node-pty` type imports so
 * those degradation paths still typecheck without the package installed.
 */

export interface PtyDisposable {
  dispose(): void;
}

export interface PtySpawnOptionsLike {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface OptionalPty {
  pid: number;
  onData(callback: (data: string) => void): PtyDisposable;
  onExit(callback: (event: { exitCode: number; signal?: number }) => void): PtyDisposable;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export interface OptionalPtyModule {
  spawn(file: string, args: string[] | string, options: PtySpawnOptionsLike): OptionalPty;
}
