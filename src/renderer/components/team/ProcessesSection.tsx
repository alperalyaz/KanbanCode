import { formatDistanceToNowStrict } from 'date-fns';
import { ExternalLink, Square, Terminal } from 'lucide-react';

import type { TeamProcess } from '@shared/types';

interface ProcessesSectionProps {
  teamName: string;
  processes: TeamProcess[];
}

function formatShortTime(date: Date): string {
  const distance = formatDistanceToNowStrict(date, { addSuffix: false });
  return distance
    .replace(' seconds', 's')
    .replace(' second', 's')
    .replace(' minutes', 'm')
    .replace(' minute', 'm')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd')
    .replace(' weeks', 'w')
    .replace(' week', 'w')
    .replace(' months', 'mo')
    .replace(' month', 'mo')
    .replace(' years', 'y')
    .replace(' year', 'y');
}

export const ProcessesSection = ({
  teamName,
  processes,
}: ProcessesSectionProps): React.JSX.Element => {
  const sorted = [...processes].sort((a, b) => {
    const aAlive = !a.stoppedAt;
    const bAlive = !b.stoppedAt;
    if (aAlive !== bAlive) return aAlive ? -1 : 1;
    return Date.parse(b.registeredAt) - Date.parse(a.registeredAt);
  });

  return (
    <div className="space-y-0.5">
      {sorted.map((proc) => {
        const alive = !proc.stoppedAt;
        const timeStr = alive
          ? `${formatShortTime(new Date(proc.registeredAt))} ago`
          : `stopped ${formatShortTime(new Date(proc.stoppedAt!))} ago`;

        return (
          <div
            key={proc.id}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-surface-raised)] ${!alive ? 'opacity-50' : ''}`}
          >
            {/* Status indicator */}
            <span
              className={`inline-block size-2 shrink-0 rounded-full ${alive ? 'bg-emerald-400' : 'bg-zinc-500'}`}
              title={alive ? 'Running' : 'Stopped'}
            />

            {/* Icon + label — takes available space */}
            <Terminal size={12} className="shrink-0 text-[var(--color-text-muted)]" />
            <span
              className="min-w-0 truncate font-medium text-[var(--color-text)]"
              title={proc.label}
            >
              {proc.label}
            </span>

            {/* Port + URL inline — only when present */}
            {(proc.port != null || proc.url) && (
              <span className="min-w-0 truncate text-[var(--color-text-secondary)]">
                {proc.port != null && `:${proc.port}`}
                {proc.port != null && proc.url && ' '}
                {proc.url}
              </span>
            )}

            {/* Right-aligned group: Kill button, Open button, author, time */}
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {alive && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
                  onClick={() => void window.electronAPI.teams.killProcess(teamName, proc.pid)}
                  title="Stop process (SIGTERM)"
                >
                  <Square size={8} className="fill-current" />
                  Kill
                </button>
              )}
              {alive && proc.url && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-blue-400 transition-colors hover:bg-blue-500/10"
                  onClick={() => void window.electronAPI.openExternal(proc.url!)}
                  title="Open in browser"
                >
                  <ExternalLink size={10} />
                  Open
                </button>
              )}
              {proc.registeredBy && (
                <span className="text-[var(--color-text-muted)]">{proc.registeredBy}</span>
              )}
              <span className="text-[var(--color-text-muted)]">{timeStr}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};
