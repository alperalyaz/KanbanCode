export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM') return true;
    }
    return false;
  }
}
