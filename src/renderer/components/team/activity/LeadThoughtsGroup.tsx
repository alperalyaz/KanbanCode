import { useEffect, useRef, useState } from 'react';

import { MemberBadge } from '@renderer/components/team/MemberBadge';
import {
  CARD_BG,
  CARD_BORDER_STYLE,
  CARD_ICON_MUTED,
  CARD_TEXT_LIGHT,
} from '@renderer/constants/cssVariables';
import { getTeamColorSet } from '@renderer/constants/teamColors';
import { ChevronRight } from 'lucide-react';

import type { InboxMessage } from '@shared/types';

export interface LeadThoughtGroup {
  type: 'lead-thoughts';
  thoughts: InboxMessage[];
}

/**
 * Check if a message is an intermediate lead "thought" (assistant text) rather than
 * an official message (SendMessage, direct reply, inbox, etc.).
 */
export function isLeadThought(msg: InboxMessage): boolean {
  if (msg.source === 'lead_session') return true;
  if (msg.source === 'lead_process' && msg.messageId?.startsWith('lead-text-')) return true;
  return false;
}

export type TimelineItem =
  | { type: 'message'; message: InboxMessage; originalIndex: number }
  | { type: 'lead-thoughts'; group: LeadThoughtGroup; originalIndices: number[] };

/**
 * Group consecutive lead thoughts into collapsible blocks.
 * Single thoughts remain as regular messages.
 */
export function groupTimelineItems(messages: InboxMessage[]): TimelineItem[] {
  const result: TimelineItem[] = [];
  let pendingThoughts: InboxMessage[] = [];
  let pendingIndices: number[] = [];

  const flushThoughts = (): void => {
    if (pendingThoughts.length === 0) return;
    if (pendingThoughts.length === 1) {
      result.push({
        type: 'message',
        message: pendingThoughts[0],
        originalIndex: pendingIndices[0],
      });
    } else {
      result.push({
        type: 'lead-thoughts',
        group: { type: 'lead-thoughts', thoughts: pendingThoughts },
        originalIndices: pendingIndices,
      });
    }
    pendingThoughts = [];
    pendingIndices = [];
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (isLeadThought(msg)) {
      pendingThoughts.push(msg);
      pendingIndices.push(i);
    } else {
      flushThoughts();
      result.push({ type: 'message', message: msg, originalIndex: i });
    }
  }
  flushThoughts();
  return result;
}

const VIEWPORT_THRESHOLD = 0.15;

interface LeadThoughtsGroupRowProps {
  group: LeadThoughtGroup;
  memberColor?: string;
  isNew?: boolean;
  onVisible?: (message: InboxMessage) => void;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return timestamp;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeWithSec(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return timestamp;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const LeadThoughtsGroupRow = ({
  group,
  memberColor,
  isNew,
  onVisible,
}: LeadThoughtsGroupRowProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reportedRef = useRef(false);

  const colors = getTeamColorSet(memberColor ?? '');
  const { thoughts } = group;
  const first = thoughts[0];
  const last = thoughts[thoughts.length - 1];
  const leadName = first.from;

  // Mark all thoughts as visible when the group enters the viewport
  useEffect(() => {
    if (!onVisible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || reportedRef.current) return;
        reportedRef.current = true;
        for (const thought of thoughts) {
          onVisible(thought);
        }
      },
      { threshold: VIEWPORT_THRESHOLD, rootMargin: '0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible, thoughts]);

  // Preview: summary of newest thought (first in array since newest-first)
  const previewText = first.summary || first.text.split('\n')[0];
  const previewTruncated =
    previewText.length > 120 ? previewText.slice(0, 117) + '...' : previewText;

  return (
    <div ref={ref} className={isNew ? 'message-enter-animate min-h-px' : 'min-h-px'}>
      <article
        className="group rounded-md [overflow:clip]"
        style={{
          backgroundColor: CARD_BG,
          border: CARD_BORDER_STYLE,
          borderLeft: `3px solid ${colors.border}`,
          opacity: 0.75,
        }}
      >
        {/* Header — click to expand/collapse */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- role=button + tabIndex + onKeyDown below */}
        <div
          role="button"
          tabIndex={0}
          className="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 hover:bg-[rgba(255,255,255,0.02)]"
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
        >
          <ChevronRight
            className="size-3 shrink-0 transition-transform duration-150"
            style={{
              color: CARD_ICON_MUTED,
              transform: expanded ? 'rotate(90deg)' : undefined,
            }}
          />
          <MemberBadge name={leadName} color={memberColor} hideAvatar />
          <span className="text-[10px]" style={{ color: CARD_ICON_MUTED }}>
            {thoughts.length} thoughts
          </span>
          <span className="text-[10px]" style={{ color: CARD_ICON_MUTED }}>
            {formatTime(last.timestamp)}–{formatTime(first.timestamp)}
          </span>
          {!expanded && (
            <span className="flex-1 truncate text-[11px]" style={{ color: CARD_TEXT_LIGHT }}>
              {previewTruncated}
            </span>
          )}
        </div>

        {/* Expanded: all thoughts as compact timestamped lines */}
        {expanded && (
          <div
            className="space-y-px border-t px-3 py-1.5"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {thoughts.map((thought, idx) => (
              <div key={thought.messageId ?? idx} className="flex gap-2 py-0.5 text-[11px]">
                <span className="shrink-0 font-mono" style={{ color: CARD_ICON_MUTED }}>
                  {formatTimeWithSec(thought.timestamp)}
                </span>
                <span className="flex-1 leading-relaxed" style={{ color: CARD_TEXT_LIGHT }}>
                  {thought.text.length > 300 ? thought.text.slice(0, 297) + '...' : thought.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
};
