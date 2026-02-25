import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';

import type { TeamTask } from '@shared/types';

interface TrashDialogProps {
  open: boolean;
  tasks: TeamTask[];
  onClose: () => void;
}

export const TrashDialog = ({ open, tasks, onClose }: TrashDialogProps): React.JSX.Element => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Trash2 size={14} className="text-[var(--color-text-muted)]" />
            Trash
          </DialogTitle>
        </DialogHeader>

        {tasks.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
            No deleted tasks
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">Subject</th>
                  <th className="pb-2 pr-3 font-medium">Owner</th>
                  <th className="pb-2 font-medium">Deleted</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-[var(--color-border-subtle)] last:border-0"
                  >
                    <td className="py-2 pr-3 text-[var(--color-text-muted)]">{task.id}</td>
                    <td className="py-2 pr-3 text-[var(--color-text)]">{task.subject}</td>
                    <td className="py-2 pr-3 text-[var(--color-text-secondary)]">
                      {task.owner ?? '—'}
                    </td>
                    <td className="py-2 text-[var(--color-text-muted)]">
                      {task.deletedAt
                        ? formatDistanceToNow(new Date(task.deletedAt), { addSuffix: true })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
