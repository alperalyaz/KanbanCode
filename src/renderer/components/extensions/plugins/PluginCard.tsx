/**
 * PluginCard — grid card for a single plugin in the catalog.
 */

import { Badge } from '@renderer/components/ui/badge';
import { useStore } from '@renderer/store';
import {
  getCapabilityLabel,
  inferCapabilities,
  normalizeCategory,
} from '@shared/utils/extensionNormalizers';

import { InstallButton } from '../common/InstallButton';
import { InstallCountBadge } from '../common/InstallCountBadge';

import type { EnrichedPlugin } from '@shared/types/extensions';

interface PluginCardProps {
  plugin: EnrichedPlugin;
  onClick: (pluginId: string) => void;
}

export const PluginCard = ({ plugin, onClick }: PluginCardProps): React.JSX.Element => {
  const capabilities = inferCapabilities(plugin);
  const category = normalizeCategory(plugin.category);
  const installProgress = useStore((s) => s.pluginInstallProgress[plugin.pluginId] ?? 'idle');
  const installPlugin = useStore((s) => s.installPlugin);
  const uninstallPlugin = useStore((s) => s.uninstallPlugin);
  const installError = useStore((s) => s.installErrors[plugin.pluginId]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(plugin.pluginId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(plugin.pluginId);
        }
      }}
      className={`flex w-full cursor-pointer flex-col gap-2 rounded-lg border p-4 text-left transition-all duration-200 hover:border-border-emphasis hover:bg-surface-raised hover:shadow-[0_0_12px_rgba(255,255,255,0.02)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-emphasis)] ${
        plugin.isInstalled ? 'border-l-2 border-border border-l-emerald-500/30' : 'border-border'
      }`}
    >
      {/* Header: name + installed badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{plugin.name}</h3>
        {plugin.isInstalled && (
          <Badge
            className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            variant="outline"
          >
            Installed
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs text-text-secondary">{plugin.description}</p>

      {/* Category + Capabilities */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-xs">
          {category}
        </Badge>
        {capabilities.map((cap) => (
          <Badge
            key={cap}
            variant="outline"
            className="border-purple-500/30 bg-purple-500/10 text-xs text-purple-400"
          >
            {getCapabilityLabel(cap)}
          </Badge>
        ))}
      </div>

      {/* Footer: author, install count, install button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs text-text-muted">
            {plugin.author?.name ?? 'Unknown author'}
          </span>
          <InstallCountBadge count={plugin.installCount} />
        </div>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <InstallButton
            state={installProgress}
            isInstalled={plugin.isInstalled}
            onInstall={() => installPlugin({ pluginId: plugin.pluginId, scope: 'user' })}
            onUninstall={() => uninstallPlugin(plugin.pluginId)}
            size="sm"
            errorMessage={installError}
          />
        </div>
      </div>
    </div>
  );
};
