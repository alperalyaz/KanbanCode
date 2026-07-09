import { memo, useMemo } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { useStore } from '@renderer/store';
import {
  formatLiveToolLabel,
  selectPrimaryLiveTool,
  selectTeamRunningTools,
} from '@renderer/utils/liveToolActivity';
import { isLeadMember } from '@shared/utils/leadDetection';
import { Loader2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import type { LeadActivityState, ResolvedTeamMember } from '@shared/types';

interface LiveWorkingStatusStripProps {
  teamName: string;
  members: ResolvedTeamMember[];
  /** Compact single-line strip for MemberCard; default is the messages-panel strip. */
  variant?: 'panel' | 'member';
  memberName?: string;
  leadActivity?: LeadActivityState;
  /** Shown on member cards when awaiting a reply and no live tool is known yet. */
  awaitingFallbackLabel?: string;
  className?: string;
}

/**
 * Cursor-like gray live status: shows the tool the agent is running right now
 * (or a "working…" fallback while leadActivity is active with no tool yet).
 * Reuses activeToolsByTeam / finishedVisibleByTeam already populated by IPC.
 */
export const LiveWorkingStatusStrip = memo(function LiveWorkingStatusStrip({
  teamName,
  members,
  variant = 'panel',
  memberName,
  leadActivity,
  awaitingFallbackLabel,
  className,
}: LiveWorkingStatusStripProps): React.JSX.Element | null {
  const { t } = useAppTranslation('team');
  const { activeByMember, finishedByMember } = useStore(
    useShallow((s) => ({
      activeByMember: s.activeToolsByTeam[teamName],
      finishedByMember: s.finishedVisibleByTeam[teamName],
    }))
  );

  const leadName = useMemo(() => members.find((m) => isLeadMember(m))?.name, [members]);

  const status = useMemo(() => {
    if (variant === 'member' && memberName) {
      const tool = selectPrimaryLiveTool(
        activeByMember?.[memberName],
        finishedByMember?.[memberName]
      );
      if (tool?.state === 'running') {
        return { kind: 'tool' as const, label: formatLiveToolLabel(tool), memberName };
      }
      if (isLeadMember({ name: memberName }) && leadActivity === 'active') {
        return {
          kind: 'working' as const,
          label: t('activity.liveStatus.working'),
          memberName,
        };
      }
      if (tool) {
        return {
          kind: 'finished' as const,
          label: formatLiveToolLabel(tool),
          memberName,
        };
      }
      if (awaitingFallbackLabel) {
        return {
          kind: 'awaiting' as const,
          label: awaitingFallbackLabel,
          memberName,
        };
      }
      return null;
    }

    // Panel: prefer any running tool on the team; else lead "working" while active.
    const running = selectTeamRunningTools(activeByMember);
    if (running[0]) {
      return {
        kind: 'tool' as const,
        label: formatLiveToolLabel(running[0]),
        memberName: running[0].memberName,
      };
    }
    if (leadActivity === 'active' && leadName) {
      return {
        kind: 'working' as const,
        label: t('activity.liveStatus.working'),
        memberName: leadName,
      };
    }
    return null;
  }, [
    activeByMember,
    awaitingFallbackLabel,
    finishedByMember,
    leadActivity,
    leadName,
    memberName,
    t,
    variant,
  ]);

  if (!status) return null;

  const showWho = status.kind === 'tool' || status.kind === 'working' || status.kind === 'finished';
  const who =
    showWho && status.memberName && members.some((m) => m.name === status.memberName)
      ? status.memberName
      : null;

  return (
    <div
      className={
        className ??
        (variant === 'member'
          ? 'flex min-w-0 items-center gap-1.5'
          : 'border-[var(--color-border)]/60 bg-[var(--color-surface-sidebar)]/80 mb-2 flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5')
      }
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-3 shrink-0 animate-spin text-[var(--color-text-muted)]" />
      <p className="min-w-0 truncate font-mono text-[11px] leading-4 text-[var(--color-text-muted)]">
        {who && variant === 'panel' ? (
          <>
            <span className="font-sans font-medium text-[var(--color-text-secondary)]">{who}</span>
            <span className="font-sans"> · </span>
          </>
        ) : null}
        <span className={status.kind === 'awaiting' ? 'font-sans' : undefined}>{status.label}</span>
      </p>
    </div>
  );
});
