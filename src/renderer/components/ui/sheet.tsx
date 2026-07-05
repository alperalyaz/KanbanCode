/* eslint-disable react/jsx-props-no-spreading -- Standard shadcn pattern: forward remaining props to underlying elements */
import * as React from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@renderer/lib/utils';
import { X } from 'lucide-react';

/**
 * Right-anchored, non-blocking side panel (drawer).
 *
 * Unlike Dialog, Sheet defaults to `modal={false}` so the surface behind it
 * (e.g. the kanban board) stays visible AND interactive — the panel slides in
 * from the right instead of taking over the screen with a blocking backdrop.
 * Escape still dismisses it.
 */
const Sheet = ({
  modal = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>): React.JSX.Element => (
  <DialogPrimitive.Root modal={modal} {...props} />
);

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Panel width. Defaults to a comfortable reading width, capped on small screens. */
    widthClassName?: string;
    /** When false, clicks outside the panel do not dismiss it (Escape still does). */
    dismissOnOutsideInteraction?: boolean;
  }
>(
  (
    {
      className,
      children,
      widthClassName = 'w-[440px] max-w-[92vw]',
      dismissOnOutsideInteraction = true,
      onInteractOutside,
      onEscapeKeyDown,
      ...props
    },
    ref
  ) => {
    const { t } = useAppTranslation('common');

    return (
      <SheetPortal>
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl outline-none',
            'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'focus:outline-none',
            widthClassName,
            className
          )}
          onInteractOutside={(event) => {
            if (!dismissOnOutsideInteraction) {
              event.preventDefault();
            }
            onInteractOutside?.(event);
          }}
          // Escape always dismisses — deliberate keystroke, not an accidental click.
          onEscapeKeyDown={onEscapeKeyDown}
          {...props}
        >
          <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full p-1.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-[var(--color-border-emphasis)] disabled:pointer-events-none">
            <X className="size-4 text-[var(--color-text-muted)]" />
            <span className="sr-only">{t('actions.close')}</span>
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div
    className={cn('flex shrink-0 flex-col space-y-1.5 border-b border-[var(--color-border)] p-4', className)}
    {...props}
  />
);

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div
    className={cn(
      'flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--color-border)] p-4 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-base font-semibold leading-none tracking-tight text-[var(--color-text)]',
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-[var(--color-text-muted)]', className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
/* eslint-enable react/jsx-props-no-spreading -- Re-enable after shadcn component */
