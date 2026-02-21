import { BarChart3 } from 'lucide-react';

import { ReportSection } from '../ReportSection';

import type {
  ReportPromptQuality,
  ReportStartupOverhead,
  ReportTestProgression,
} from '@renderer/types/sessionReport';

const assessmentColor = (assessment: ReportPromptQuality['assessment']): string => {
  switch (assessment) {
    case 'well_specified':
      return '#4ade80';
    case 'moderate_friction':
      return '#fbbf24';
    case 'underspecified':
      return '#f87171';
    case 'verbose_but_unclear':
      return '#f87171';
    default:
      return '#a1a1aa';
  }
};

const assessmentLabel = (assessment: ReportPromptQuality['assessment']): string => {
  switch (assessment) {
    case 'well_specified':
      return 'Well Specified';
    case 'moderate_friction':
      return 'Moderate Friction';
    case 'underspecified':
      return 'Underspecified';
    case 'verbose_but_unclear':
      return 'Verbose but Unclear';
    default:
      return assessment;
  }
};

const trajectoryColor = (trajectory: ReportTestProgression['trajectory']): string => {
  switch (trajectory) {
    case 'improving':
      return '#4ade80';
    case 'regressing':
      return '#f87171';
    case 'stable':
      return '#fbbf24';
    default:
      return '#a1a1aa';
  }
};

interface QualitySectionProps {
  prompt: ReportPromptQuality;
  startup: ReportStartupOverhead;
  testProgression: ReportTestProgression;
}

export const QualitySection = ({ prompt, startup, testProgression }: QualitySectionProps) => {
  return (
    <ReportSection title="Quality Signals" icon={BarChart3}>
      {/* Prompt quality */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium text-text-muted">Prompt Quality</div>
        <div className="mb-2 flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${assessmentColor(prompt.assessment)}20`,
              color: assessmentColor(prompt.assessment),
            }}
          >
            {assessmentLabel(prompt.assessment)}
          </span>
        </div>
        <div className="text-xs text-text-secondary">{prompt.note}</div>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-text-muted">First Message</div>
            <div className="text-sm font-medium text-text">
              {prompt.firstMessageLengthChars.toLocaleString()} chars
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">User Messages</div>
            <div className="text-sm font-medium text-text">{prompt.userMessageCount}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Corrections</div>
            <div className="text-sm font-medium text-text">{prompt.correctionCount}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Friction Rate</div>
            <div className="text-sm font-medium text-text">
              {(prompt.frictionRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Startup overhead */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium text-text-muted">Startup Overhead</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-text-muted">Messages Before Work</div>
            <div className="text-sm font-medium text-text">{startup.messagesBeforeFirstWork}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Tokens Before Work</div>
            <div className="text-sm font-medium text-text">
              {startup.tokensBeforeFirstWork.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">% of Total</div>
            <div className="text-sm font-medium text-text">{startup.pctOfTotal}%</div>
          </div>
        </div>
      </div>

      {/* Test progression */}
      <div>
        <div className="mb-2 text-xs font-medium text-text-muted">Test Progression</div>
        <div className="mb-2 flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${trajectoryColor(testProgression.trajectory)}20`,
              color: trajectoryColor(testProgression.trajectory),
            }}
          >
            {testProgression.trajectory === 'insufficient_data'
              ? 'Insufficient Data'
              : testProgression.trajectory.charAt(0).toUpperCase() +
                testProgression.trajectory.slice(1)}
          </span>
          <span className="text-xs text-text-muted">
            {testProgression.snapshotCount} snapshot{testProgression.snapshotCount !== 1 ? 's' : ''}
          </span>
        </div>
        {testProgression.firstSnapshot && testProgression.lastSnapshot && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-text-muted">First Run</div>
              <div className="text-sm text-text">
                <span style={{ color: '#4ade80' }}>
                  {testProgression.firstSnapshot.passed} passed
                </span>
                {' / '}
                <span style={{ color: '#f87171' }}>
                  {testProgression.firstSnapshot.failed} failed
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Last Run</div>
              <div className="text-sm text-text">
                <span style={{ color: '#4ade80' }}>
                  {testProgression.lastSnapshot.passed} passed
                </span>
                {' / '}
                <span style={{ color: '#f87171' }}>
                  {testProgression.lastSnapshot.failed} failed
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReportSection>
  );
};
