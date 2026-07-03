import { useAppTranslation } from '@features/localization/renderer';
import { Button } from '@renderer/components/ui/button';
import appIcon from '@renderer/favicon.png';
import { APP_NAME } from '@shared/constants/brand';
import { Plus, UsersRound } from 'lucide-react';

interface TeamListEmptyStateProps {
  canCreate: boolean;
  onCreateTeam: () => void;
}

export const TeamListEmptyState = ({
  canCreate,
  onCreateTeam,
}: Readonly<TeamListEmptyStateProps>): React.JSX.Element => {
  const { t } = useAppTranslation('team');

  return (
    <div className="relative flex min-h-[min(70vh,560px)] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <img
        src={appIcon}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-[min(42vw,320px)] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.07]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,rgba(99,102,241,0.12),transparent)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        <div className="bg-surface-raised/90 mb-5 flex size-16 items-center justify-center rounded-2xl border border-border shadow-[0_12px_40px_rgba(15,23,42,0.22)]">
          <UsersRound className="size-8 text-indigo-300" />
        </div>
        <p className="mb-2 text-xs font-medium tracking-wide text-indigo-300/80">{APP_NAME}</p>
        <h3 className="text-2xl font-semibold tracking-tight text-text">{t('list.empty.title')}</h3>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          {canCreate ? t('list.empty.description') : t('list.empty.localOnly')}
        </p>
        {canCreate ? (
          <Button className="mt-8" size="lg" onClick={onCreateTeam}>
            <Plus className="size-4" />
            {t('list.actions.createTeam')}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
