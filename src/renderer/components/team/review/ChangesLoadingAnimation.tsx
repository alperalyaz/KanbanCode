import { FileCode, FileDiff, FileText, GitCommit, RefreshCw } from 'lucide-react';

const floatingIcons = [
  { Icon: FileText, delay: '0s', x: -40, y: -30 },
  { Icon: FileDiff, delay: '0.4s', x: 35, y: -25 },
  { Icon: FileCode, delay: '0.8s', x: -30, y: 20 },
  { Icon: GitCommit, delay: '1.2s', x: 40, y: 15 },
  { Icon: RefreshCw, delay: '1.6s', x: 0, y: -40 },
];

export const ChangesLoadingAnimation = (): React.JSX.Element => {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-6">
      {/* Animated icons cluster */}
      <div className="relative flex size-28 items-center justify-center">
        {/* Central pulsing ring */}
        <div className="absolute size-16 animate-ping rounded-full bg-[var(--color-text-muted)] opacity-[0.04]" />
        <div
          className="absolute size-20 rounded-full bg-[var(--color-text-muted)] opacity-[0.03]"
          style={{ animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s' }}
        />

        {/* Floating file icons */}
        {floatingIcons.map(({ Icon, delay, x, y }, i) => (
          <div
            key={i}
            className="absolute text-[var(--color-text-muted)]"
            style={{
              animation: `changesFloat 2.5s ease-in-out infinite ${delay}`,
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Icon size={16} strokeWidth={1.5} />
          </div>
        ))}

        {/* Center icon */}
        <div
          className="relative z-10 flex size-10 items-center justify-center rounded-xl border border-[var(--color-border-emphasis)] bg-[var(--color-surface-raised)]"
          style={{ animation: 'changesBreath 2s ease-in-out infinite' }}
        >
          <FileDiff size={20} className="text-[var(--color-text-secondary)]" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-48 overflow-hidden rounded-full bg-[var(--color-surface-raised)]">
        <div
          className="h-0.5 rounded-full bg-[var(--color-text-muted)]"
          style={{ animation: 'changesProgress 2s ease-in-out infinite' }}
        />
      </div>

      {/* Text */}
      <p
        className="text-xs font-medium tracking-wide text-[var(--color-text-muted)]"
        style={{ animation: 'changesFade 2s ease-in-out infinite' }}
      >
        Loading changes...
      </p>

      <style>{`
        @keyframes changesFloat {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.85); }
          50% { opacity: 0.7; transform: translate(-50%, calc(-50% - 6px)) scale(1); }
        }
        @keyframes changesBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes changesProgress {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
        @keyframes changesFade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
