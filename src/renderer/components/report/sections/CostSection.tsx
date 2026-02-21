import { DollarSign } from 'lucide-react';

import { ReportSection } from '../ReportSection';

import type { ReportCostAnalysis } from '@renderer/types/sessionReport';

const fmt = (v: number) => `$${v.toFixed(4)}`;

interface CostSectionProps {
  data: ReportCostAnalysis;
}

export const CostSection = ({ data }: CostSectionProps) => {
  const modelEntries = Object.entries(data.costByModel).sort((a, b) => b[1] - a[1]);

  return (
    <ReportSection title="Cost Analysis" icon={DollarSign}>
      <div className="mb-4 text-2xl font-bold text-text">{fmt(data.totalSessionCostUsd)}</div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="text-xs text-text-muted">Parent Cost</div>
          <div className="text-sm font-medium text-text">{fmt(data.parentCostUsd)}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Subagent Cost</div>
          <div className="text-sm font-medium text-text">{fmt(data.subagentCostUsd)}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Per Commit</div>
          <div className="text-sm font-medium text-text">
            {data.costPerCommit != null ? fmt(data.costPerCommit) : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Per Line Changed</div>
          <div className="text-sm font-medium text-text">
            {data.costPerLineChanged != null ? `$${data.costPerLineChanged.toFixed(6)}` : 'N/A'}
          </div>
        </div>
      </div>

      {modelEntries.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="pb-2 pr-4">Model</th>
              <th className="pb-2 pr-4 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {modelEntries.map(([model, cost]) => (
              <tr key={model} className="border-border/50 border-b">
                <td className="py-1.5 pr-4 text-text">{model}</td>
                <td className="py-1.5 pr-4 text-right text-text">{fmt(cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ReportSection>
  );
};
