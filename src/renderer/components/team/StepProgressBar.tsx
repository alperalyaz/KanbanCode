import { cn } from '@renderer/lib/utils';
import { Check } from 'lucide-react';

export interface StepProgressBarStep {
  key: string;
  label: string;
}

export interface StepProgressBarProps {
  steps: StepProgressBarStep[];
  /** 0-based index of the current step, -1 if not started */
  currentIndex: number;
  className?: string;
}

/**
 * Circular step progress indicator with animated connecting lines.
 *
 * - Completed steps: green circle with checkmark
 * - Current step: green outlined circle with pulsing ring + number
 * - Pending steps: gray circle with number
 * - Lines between steps animate with a green fill for completed transitions
 */
export const StepProgressBar = ({
  steps,
  currentIndex,
  className,
}: StepProgressBarProps): React.JSX.Element => {
  return (
    <div className={cn('flex items-start justify-center', className)}>
      {steps.map((step, index) => {
        const isDone = currentIndex >= 0 && index < currentIndex;
        const isCurrent = currentIndex >= 0 && index === currentIndex;
        const isLast = index === steps.length - 1;

        // The connecting line between this step and the next
        const lineState: 'done' | 'active' | 'pending' =
          isDone && !isLast ? 'done' : isCurrent && !isLast ? 'active' : 'pending';

        return (
          <div
            key={step.key}
            className="flex items-start"
            style={{ flex: isLast ? '0 0 auto' : '1 1 0%' }}
          >
            {/* Step circle + label column */}
            <div className="flex flex-col items-center" style={{ width: 56 }}>
              {/* Circle */}
              <div
                className={cn(
                  'relative flex items-center justify-center rounded-full transition-all duration-300',
                  // Sizing
                  'size-7',
                  // Done state
                  isDone && 'bg-[var(--stepper-done)] shadow-[0_0_8px_var(--stepper-done-glow)]',
                  // Current state
                  isCurrent && 'border-2 border-[var(--stepper-current)] bg-transparent',
                  // Pending state
                  !isDone &&
                    !isCurrent &&
                    'border border-[var(--stepper-pending-border)] bg-[var(--stepper-pending)]'
                )}
                style={
                  isCurrent
                    ? { animation: 'stepper-pulse-ring 2s ease-in-out infinite' }
                    : undefined
                }
              >
                {isDone ? (
                  <Check className="size-3.5 text-white" strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      'text-[11px] font-semibold leading-none',
                      isCurrent
                        ? 'text-[var(--stepper-current)]'
                        : 'text-[var(--stepper-pending-text)]'
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'mt-1.5 text-center text-[10px] leading-tight transition-colors duration-300',
                  isDone || isCurrent
                    ? 'font-medium text-[var(--stepper-label-active)]'
                    : 'text-[var(--stepper-label)]'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {!isLast && (
              <div
                className="relative mt-3.5 h-[2px] flex-1 overflow-hidden"
                style={{ minWidth: 16 }}
              >
                {/* Background track */}
                <div className="absolute inset-0 rounded-full bg-[var(--stepper-line)]" />

                {lineState === 'done' ? (
                  /* Fully filled green line */
                  <div className="absolute inset-0 rounded-full bg-[var(--stepper-line-done)]" />
                ) : lineState === 'active' ? (
                  /* Cyclic sweep — green highlight sliding left-to-right in a loop */
                  <div
                    className="absolute top-0 h-full rounded-full bg-[var(--stepper-line-done)]"
                    style={{
                      width: '40%',
                      animation: 'stepper-line-sweep 1.2s ease-in-out infinite',
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
