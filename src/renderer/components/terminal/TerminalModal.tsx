import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { useAppTranslation } from '@features/localization/renderer';
import { Check, Copy, Terminal, X } from 'lucide-react';

interface TerminalModalProps {
  /** Modal title */
  title?: string;
  /** Command to run */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables merged into the PTY process env */
  env?: Record<string, string>;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when the PTY process exits */
  onExit?: (exitCode: number) => void;
  /** Auto-close the modal after this many ms on success (exit code 0). 0 = disabled. */
  autoCloseOnSuccessMs?: number;
  /** Custom message shown on exit code 0. Default: "Completed successfully" */
  successMessage?: string;
  /** Custom message prefix for non-zero exit. Default: "Process failed" */
  failureMessage?: string;
}

/** Quote a shell word with POSIX single quotes when it contains unsafe characters. */
const quoteShellWord = (word: string): string =>
  /^[A-Za-z0-9_@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;

/** Build the full command line the user should run in their own terminal. */
const buildCommandLine = (
  command?: string,
  args?: string[],
  cwd?: string,
  env?: Record<string, string>
): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(env ?? {})) {
    parts.push(`${key}=${quoteShellWord(value)}`);
  }
  if (command) {
    parts.push(quoteShellWord(command));
  }
  for (const arg of args ?? []) {
    parts.push(quoteShellWord(arg));
  }
  const line = parts.join(' ');
  return cwd ? `cd ${quoteShellWord(cwd)} && ${line}` : line;
};

export function TerminalModal({
  title,
  command,
  args,
  cwd,
  env,
  onClose,
}: TerminalModalProps): React.JSX.Element {
  const { t } = useAppTranslation('common');
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedTitle = title ?? t('terminalCommandModal.title');
  const commandLine = buildCommandLine(command, args, cwd, env);
  const hasEnv = Object.keys(env ?? {}).length > 0;

  const handleCopy = useCallback((): void => {
    void navigator.clipboard.writeText(commandLine).then(() => {
      setCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [commandLine]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  // Focus trap — focus dialog on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Clear pending "Copied" reset timer on unmount
  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  return ReactDOM.createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- modal backdrop handles Escape + click-to-close
    <div
      // z-[100] keeps this above any Radix dialog (z-50) it is layered over, so its
      // close controls stay clickable. Clicking the backdrop also closes it, so the
      // user is never trapped if a click misses the X.
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        // Only a direct click on the backdrop (not one bubbling up from the
        // dialog body) closes the modal.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={resolvedTitle}
        aria-modal="true"
        tabIndex={-1}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border-emphasis bg-surface shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text">
            <Terminal size={16} className="text-text-secondary" />
            {resolvedTitle}
          </div>
          <button
            onClick={onClose}
            aria-label={t('actions.close')}
            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-sm text-text-secondary">{t('terminalCommandModal.instructions')}</p>

          <div className="flex items-start gap-2">
            <pre
              className="min-w-0 flex-1 overflow-x-auto rounded border px-3 py-2.5 font-mono text-xs"
              style={{
                backgroundColor: '#141416',
                borderColor: 'var(--color-border)',
                color: '#fafafa',
              }}
            >
              {commandLine}
            </pre>
            <button
              onClick={handleCopy}
              aria-label={t('terminalCommandModal.copyCommand')}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-surface-raised px-3 py-2 text-sm text-text transition-colors hover:bg-border-emphasis"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-400" aria-hidden="true" />
                  {t('terminalCommandModal.copied')}
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden="true" />
                  {t('terminalCommandModal.copy')}
                </>
              )}
            </button>
          </div>

          {hasEnv && (
            <p className="text-xs text-text-muted">{t('terminalCommandModal.windowsEnvNote')}</p>
          )}

          <p className="text-xs text-text-muted">{t('terminalCommandModal.afterRun')}</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md bg-surface-raised px-4 py-1.5 text-sm text-text transition-colors hover:bg-border-emphasis"
          >
            {t('actions.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
