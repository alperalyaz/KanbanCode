import { Wrench } from 'lucide-react';

import { ReportSection } from '../ReportSection';

import type { ReportToolUsage } from '@renderer/types/sessionReport';

interface ToolSectionProps {
  data: ReportToolUsage;
}

export const ToolSection = ({ data }: ToolSectionProps) => {
  const toolEntries = Object.entries(data.successRates).sort(
    (a, b) => b[1].totalCalls - a[1].totalCalls
  );

  return (
    <ReportSection title="Tool Usage" icon={Wrench}>
      <div className="mb-2 text-xs text-text-muted">
        {data.totalCalls.toLocaleString()} total calls across {toolEntries.length} tools
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="pb-2 pr-4">Tool</th>
              <th className="pb-2 pr-4 text-right">Calls</th>
              <th className="pb-2 pr-4 text-right">Errors</th>
              <th className="pb-2 text-right">Success %</th>
            </tr>
          </thead>
          <tbody>
            {toolEntries.map(([tool, stats]) => {
              const rateColor =
                stats.successRatePct < 80
                  ? '#f87171'
                  : stats.successRatePct < 90
                    ? '#fbbf24'
                    : undefined;

              return (
                <tr key={tool} className="border-border/50 border-b">
                  <td className="py-1.5 pr-4 text-text">{tool}</td>
                  <td className="py-1.5 pr-4 text-right text-text">
                    {stats.totalCalls.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-text">
                    {stats.errors.toLocaleString()}
                  </td>
                  <td
                    className="py-1.5 text-right"
                    style={rateColor ? { color: rateColor } : undefined}
                  >
                    {stats.successRatePct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ReportSection>
  );
};
