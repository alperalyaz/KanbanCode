import { useEffect, useMemo, useRef } from 'react';

interface TerminalLogPanelProps {
  /** Raw output chunks (with ANSI codes) to render */
  chunks: string[];
  /** CSS class for container */
  className?: string;
}

// Matches CSI sequences (ESC [ ... final byte), OSC sequences (ESC ] ... BEL or ESC \),
// other two-byte escapes, and stray control characters (except \t, \n, \r) from process output.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN =
  /\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[@-_]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** Remove ANSI escape sequences and non-printable control characters. */
const stripAnsi = (text: string): string => text.replace(ANSI_PATTERN, '');

export const TerminalLogPanel = ({
  chunks,
  className,
}: TerminalLogPanelProps): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);

  const text = useMemo(() => stripAnsi(chunks.join('')).replace(/\r\n?/g, '\n'), [chunks]);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`mt-2 overflow-y-auto rounded border ${className ?? ''}`}
      style={{
        backgroundColor: '#141416',
        borderColor: 'var(--color-border)',
        height: '120px',
      }}
    >
      <pre
        className="m-0 whitespace-pre-wrap break-words px-2 py-1.5"
        style={{
          color: '#fafafa',
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          fontSize: '12px',
          lineHeight: 1.4,
        }}
      >
        {text}
      </pre>
    </div>
  );
};
