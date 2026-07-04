import React, { useCallback, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { PROTECTED_CLI_FLAGS } from '@shared/utils/cliArgsParser';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, Terminal, XCircle } from 'lucide-react';

interface AdvancedCliSectionProps {
  teamName: string;
  /**
   * All CLI args from parent (model, effort, permissions, resume, etc.).
   * Retained for call-site compatibility; no longer rendered as a preview.
   */
  internalArgs: string[];
  worktreeEnabled: boolean;
  onWorktreeEnabledChange: (enabled: boolean) => void;
  worktreeName: string;
  onWorktreeNameChange: (name: string) => void;
  customArgs: string;
  onCustomArgsChange: (args: string) => void;
}

type ValidationState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Collapsible "Advanced" section for CreateTeamDialog and LaunchTeamDialog.
 * Contains: worktree checkbox + name input, and custom args validated inline on blur.
 */
export const AdvancedCliSection: React.FC<AdvancedCliSectionProps> = ({
  teamName,
  worktreeEnabled,
  onWorktreeEnabledChange,
  worktreeName,
  onWorktreeNameChange,
  customArgs,
  onCustomArgsChange,
}) => {
  const { t } = useAppTranslation('team');
  const [isOpen, setIsOpen] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Validate custom args inline; runs on blur of the custom-args input.
  const handleValidate = useCallback(async () => {
    if (!customArgs.trim()) return;
    setValidationState('loading');
    setValidationMessage(null);
    try {
      const result = await window.electronAPI.teams.validateCliArgs(customArgs);
      if (result.valid) {
        setValidationState('success');
        setValidationMessage(t('advancedCli.validation.allFlagsValid'));
      } else {
        setValidationState('error');
        const flags = result.invalidFlags ?? [];
        const unknown = flags.filter((f) => !PROTECTED_CLI_FLAGS.has(f));
        const protectedOnes = flags.filter((f) => PROTECTED_CLI_FLAGS.has(f));
        const parts: string[] = [];
        if (unknown.length > 0) {
          parts.push(t('advancedCli.validation.unknownFlags', { flags: unknown.join(', ') }));
        }
        if (protectedOnes.length > 0) {
          parts.push(
            t('advancedCli.validation.protectedFlags', { flags: protectedOnes.join(', ') })
          );
        }
        setValidationMessage(parts.join(' | '));
      }
    } catch (err) {
      setValidationState('error');
      setValidationMessage(err instanceof Error ? err.message : t('advancedCli.validation.failed'));
    }
  }, [customArgs]);

  // Reset validation when custom args change.
  const handleCustomArgsChange = useCallback(
    (value: string) => {
      onCustomArgsChange(value);
      if (validationState !== 'idle') {
        setValidationState('idle');
        setValidationMessage(null);
      }
    },
    [onCustomArgsChange, validationState]
  );

  return (
    <div className="mt-3">
      {/* Collapsible header */}
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-text-secondary transition-colors hover:text-text"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronRight
          className={`size-3.5 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
        />
        <Terminal className="size-3" />
        <span>{t('advancedCli.title')}</span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-3 pl-5">
          {/* Worktree */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`worktree-${teamName}`}
                checked={worktreeEnabled}
                onCheckedChange={(value) => onWorktreeEnabledChange(value === true)}
              />
              <Label
                htmlFor={`worktree-${teamName}`}
                className="cursor-pointer text-xs font-normal text-text-secondary"
              >
                {t('advancedCli.useWorktree')}
              </Label>
            </div>

            {worktreeEnabled && (
              <Input
                placeholder={t('advancedCli.placeholders.worktreeName')}
                className="h-7 font-mono text-xs"
                value={worktreeName}
                onChange={(e) => onWorktreeNameChange(e.target.value)}
              />
            )}
          </div>

          {/* Custom arguments (validated inline on blur) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {t('advancedCli.customArguments')}
            </span>
            <Input
              placeholder="--max-turns 5"
              className="h-7 w-full font-mono text-xs"
              value={customArgs}
              onChange={(e) => handleCustomArgsChange(e.target.value)}
              onBlur={handleValidate}
            />

            {/* Validation result */}
            {validationState === 'loading' && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Loader2 className="size-3 animate-spin" />
              </div>
            )}
            {validationState === 'success' && validationMessage && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="size-3" />
                <span>{validationMessage}</span>
              </div>
            )}
            {validationState === 'error' && validationMessage && (
              <div className="flex items-start gap-1.5 text-xs">
                {validationMessage.includes('Protected') ? (
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400" />
                ) : (
                  <XCircle className="mt-0.5 size-3 shrink-0 text-red-400" />
                )}
                <span className="text-text-secondary">{validationMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
