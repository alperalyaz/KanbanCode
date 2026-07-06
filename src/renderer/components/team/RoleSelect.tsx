import React, { useCallback, useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { Combobox } from '@renderer/components/ui/combobox';
import { HoverTooltip } from '@renderer/components/ui/hover-tooltip';
import { Input } from '@renderer/components/ui/input';
import { CUSTOM_ROLE, FORBIDDEN_ROLES, NO_ROLE, PRESET_ROLES } from '@renderer/constants/teamRoles';
import { Blocks, BookOpen, Bug, Check, Code2, FileText, Pencil, Shield, Zap } from 'lucide-react';

import type { ComboboxOption } from '@renderer/components/ui/combobox';
import type { LucideIcon } from 'lucide-react';

/** Icon mapping for preset roles. */
const ROLE_ICONS: Record<string, LucideIcon> = {
  architect: Blocks,
  reviewer: BookOpen,
  developer: Code2,
  qa: Bug,
  researcher: BookOpen,
  docs: FileText,
  auditor: Shield,
  optimizer: Zap,
};

const CUSTOM_ICON = Pencil;

interface RoleSelectProps {
  /** Current role selection value (preset role name, CUSTOM_ROLE, or NO_ROLE). */
  value: string;
  /** Called when the user picks a preset role, NO_ROLE, or CUSTOM_ROLE. */
  onValueChange: (value: string) => void;
  /** Current custom role text (only relevant when value === CUSTOM_ROLE). */
  customRole?: string;
  /** Called when the user types a custom role. */
  onCustomRoleChange?: (customRole: string) => void;
  /** Trigger height class, e.g. "h-7" or "h-8". */
  triggerClassName?: string;
  /** Custom input height class. */
  inputClassName?: string;
  /** Show validation error for custom role. */
  customRoleError?: string | null;
  /** Validate custom role on change and return error or null. */
  onCustomRoleValidate?: (role: string) => string | null;
  disabled?: boolean;
  /** Hide the helper line about picking only the roles a project needs. */
  hideSelectionHint?: boolean;
}

function getRoleIcon(optionValue: string): LucideIcon | null {
  if (optionValue === CUSTOM_ROLE) {
    return CUSTOM_ICON;
  }
  if (optionValue === NO_ROLE) {
    return null;
  }
  return ROLE_ICONS[optionValue] ?? null;
}

// eslint-disable-next-line sonarjs/function-return-type -- option renderer returns mixed node structure
const renderRoleOption = (option: ComboboxOption, isSelected: boolean): React.ReactNode => {
  const Icon = getRoleIcon(option.value);
  const description = option.description?.trim();

  const row = (
    <>
      <span className="mr-2 mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {isSelected ? (
          <Check className="size-3.5" />
        ) : Icon ? (
          <Icon className="size-3.5 text-[var(--color-text-muted)]" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[var(--color-text)]">{option.label}</span>
        {description ? (
          <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-[var(--color-text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!description) {
    return row;
  }

  return (
    <HoverTooltip
      as="div"
      className="w-full min-w-0"
      content={description}
      side="left"
      align="start"
      contentClassName="max-w-xs whitespace-pre-line"
    >
      {row}
    </HoverTooltip>
  );
};

export const RoleSelect = ({
  value,
  onValueChange,
  customRole = '',
  onCustomRoleChange,
  triggerClassName,
  inputClassName,
  customRoleError: externalError,
  onCustomRoleValidate,
  disabled,
  hideSelectionHint = true,
}: RoleSelectProps): React.JSX.Element => {
  const { t } = useAppTranslation('team');
  const roleOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: NO_ROLE,
        label: t('roleSelect.noRole'),
        description: t('roleSelect.noRoleDescription'),
      },
      ...PRESET_ROLES.map((role) => ({
        value: role,
        label: t(`roleSelect.presets.${role}.label`),
        description: t(`roleSelect.presets.${role}.description`),
      })),
      {
        value: CUSTOM_ROLE,
        label: t('roleSelect.customRole'),
        description: t('roleSelect.customRoleDescription'),
      },
    ],
    [t]
  );
  const [internalError, setInternalError] = useState<string | null>(null);
  const error = externalError ?? internalError;

  const handleValueChange = useCallback(
    (newValue: string) => {
      onValueChange(newValue);
      if (newValue !== CUSTOM_ROLE) {
        setInternalError(null);
      }
    },
    [onValueChange]
  );

  const handleCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onCustomRoleChange?.(val);

      if (onCustomRoleValidate) {
        setInternalError(onCustomRoleValidate(val));
      } else if (FORBIDDEN_ROLES.has(val.trim().toLowerCase())) {
        setInternalError(t('roleSelect.reservedRole'));
      } else {
        setInternalError(null);
      }
    },
    [onCustomRoleChange, onCustomRoleValidate, t]
  );

  const selectedLabel = useMemo(() => {
    const opt = roleOptions.find((o) => o.value === value);
    return opt?.label;
  }, [roleOptions, value]);

  const renderTriggerLabel = useCallback((option: ComboboxOption) => {
    const Icon = getRoleIcon(option.value);
    return (
      <span className="flex items-center gap-1.5">
        {Icon ? <Icon className="size-3 text-[var(--color-text-muted)]" /> : null}
        {option.label}
      </span>
    );
  }, []);

  return (
    <div className="space-y-1">
      {!hideSelectionHint ? (
        <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
          {t('roleSelect.selectionHint')}
        </p>
      ) : null}
      <Combobox
        options={roleOptions}
        value={value}
        onValueChange={handleValueChange}
        placeholder={selectedLabel ?? t('roleSelect.noRole')}
        searchPlaceholder={t('roleSelect.searchPlaceholder')}
        emptyMessage={t('roleSelect.empty')}
        disabled={disabled}
        className={triggerClassName}
        contentClassName="z-[70] min-w-[min(100vw-2rem,22rem)] sm:min-w-[20rem]"
        renderOption={renderRoleOption}
        renderTriggerLabel={renderTriggerLabel}
      />
      {value === CUSTOM_ROLE && onCustomRoleChange ? (
        <div>
          <Input
            className={inputClassName ?? 'h-8 text-xs'}
            value={customRole}
            onChange={handleCustomChange}
            placeholder={t('members.roleSelect.customRolePlaceholder')}
            title={t('roleSelect.customRoleDescription')}
            autoFocus
          />
          {error ? <span className="mt-0.5 block text-[10px] text-red-400">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
};
