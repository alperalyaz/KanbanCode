import React, { useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { useTheme } from '@renderer/hooks/useTheme';
import { cn } from '@renderer/lib/utils';
import { getTeamModelLabel } from '@renderer/utils/teamModelCatalog';
import { ChevronRight, Settings2 } from 'lucide-react';

interface OptionalSettingsSectionProps {
  title: string;
  description: string;
  summary?: string[];
  defaultOpen?: boolean;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const SUMMARY_PREFIXES_TO_STRIP = ['Provider:', 'Model:', 'Effort:', 'Worktree:'];

// Non-model chip shortenings the model catalog cannot produce.
const SUMMARY_CHIP_REWRITES: Array<[RegExp, string]> = [
  [/^Auto-approve tools$/i, 'Tools auto'],
  [/^Anthropic limited to 200K context$/i, '200K limit'],
];

const toCompactChip = (value: string): string => {
  let chip = value.trim();
  let matchedPrefix: string | null = null;
  for (const prefix of SUMMARY_PREFIXES_TO_STRIP) {
    if (chip.toLowerCase().startsWith(prefix.toLowerCase())) {
      chip = chip.slice(prefix.length).trim();
      matchedPrefix = prefix;
      break;
    }
  }
  // Prettify ONLY model chips via the shared catalog, so new model releases no
  // longer require a hand-maintained label table. Never route other chips
  // through it: a worktree name like "feature/login" would be parsed as an
  // OpenCode-qualified model ref and truncated to the segment after the slash.
  if (matchedPrefix === 'Model:') {
    chip = getTeamModelLabel(chip) ?? chip;
  }
  for (const [pattern, label] of SUMMARY_CHIP_REWRITES) {
    if (pattern.test(chip)) {
      chip = label;
      break;
    }
  }
  if (chip.length > 28) {
    chip = `${chip.slice(0, 27)}…`;
  }
  return chip;
};

export const OptionalSettingsSection = ({
  title,
  description,
  summary = [],
  defaultOpen = false,
  className,
  onOpenChange,
  children,
}: OptionalSettingsSectionProps): React.JSX.Element => {
  const { t } = useAppTranslation('team');
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isLight } = useTheme();

  const chips = useMemo(() => {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const raw of summary) {
      const chip = toCompactChip(raw);
      if (!chip) continue;
      const key = chip.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(chip);
      if (result.length >= 3) break;
    }
    return result;
  }, [summary]);

  const overflowCount = useMemo(() => {
    const total = summary.map((value) => value.trim()).filter(Boolean).length;
    return Math.max(0, total - chips.length);
  }, [summary, chips.length]);

  const containerBackground = isLight
    ? 'color-mix(in srgb, var(--color-surface-overlay) 30%, white 70%)'
    : 'var(--color-surface-overlay)';

  const contentBackground = isLight
    ? 'color-mix(in srgb, var(--color-surface-overlay) 52%, white 48%)'
    : 'color-mix(in srgb, var(--color-surface-raised) 88%, black 12%)';

  const headerTitleColor = isLight
    ? 'var(--color-text)'
    : 'color-mix(in srgb, var(--color-text) 82%, white 18%)';

  const headerMutedColor = isLight
    ? 'color-mix(in srgb, var(--color-text-muted) 58%, var(--color-text) 42%)'
    : 'color-mix(in srgb, var(--color-text-muted) 52%, white 48%)';

  const headerIconColor = isLight
    ? 'color-mix(in srgb, var(--color-text-muted) 64%, var(--color-text) 36%)'
    : 'color-mix(in srgb, var(--color-text-muted) 54%, white 46%)';

  const handleToggleOpen = (): void => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--color-border-emphasis)] shadow-sm',
        className
      )}
      style={{
        backgroundColor: containerBackground,
      }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-[var(--color-surface-raised)]"
        onClick={handleToggleOpen}
        aria-expanded={isOpen}
      >
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-surface-raised)]"
          style={{ color: headerIconColor }}
        >
          <Settings2 className="size-3.5" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium" style={{ color: headerTitleColor }}>
            {title}
          </span>
          <span
            className="shrink-0 rounded-full border border-[var(--color-border-emphasis)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 text-[10px] font-medium"
            style={{ color: headerMutedColor }}
          >
            {t('dialogs.optional.badge')}
          </span>

          {!isOpen && chips.length > 0 ? (
            <div
              className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
              style={{ color: headerMutedColor }}
            >
              <span aria-hidden="true" className="select-none text-[11px] opacity-50">
                •
              </span>
              <div className="flex min-w-0 items-center gap-1.5">
                {chips.map((chip, index) => (
                  <React.Fragment key={`${chip}-${index}`}>
                    {index > 0 ? (
                      <span aria-hidden="true" className="select-none text-[11px] opacity-50">
                        •
                      </span>
                    ) : null}
                    <span className="truncate rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 text-[11px]">
                      {chip}
                    </span>
                  </React.Fragment>
                ))}
                {overflowCount > 0 ? (
                  <>
                    <span aria-hidden="true" className="select-none text-[11px] opacity-50">
                      •
                    </span>
                    <span className="shrink-0 text-[11px]">+{overflowCount}</span>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <ChevronRight
          className={cn('size-4 shrink-0 transition-transform duration-150', isOpen && 'rotate-90')}
          style={{ color: headerIconColor }}
        />
      </button>

      {isOpen ? (
        <div
          className="border-t border-[var(--color-border-emphasis)] px-3 pb-3 pt-2.5"
          style={{
            backgroundColor: contentBackground,
          }}
        >
          {description ? (
            <p className="mb-3 text-xs" style={{ color: headerMutedColor }}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
};
