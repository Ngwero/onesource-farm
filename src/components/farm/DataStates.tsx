import type { ReactNode } from 'react';
import { AlertTriangle, MoveHorizontal, Sprout } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Shown above wide tables on small screens. */
export function MobileTableHint({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'mb-2 flex items-center gap-1.5 text-xs text-muted-foreground md:hidden',
        className
      )}
    >
      <MoveHorizontal className="size-3.5 shrink-0" aria-hidden />
      Swipe sideways for more columns
    </p>
  );
}

export function LoadingRows({ columns, rows = 4 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, c) => (
            <TableCell key={c} className="py-3.5">
              <Skeleton
                className={cn('h-3.5', c === 0 ? 'w-[72%]' : c === columns - 1 ? 'ml-auto w-14' : 'w-[55%]')}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function EmptyRow({
  columns,
  title,
  description,
  action,
  compact = true,
}: {
  columns: number;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columns} className={compact ? 'py-10' : undefined}>
        <EmptyState title={title} description={description} action={action} compact={compact} />
      </TableCell>
    </TableRow>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('empty-state', compact && 'empty-state--compact')}>
      {!compact ? (
        <div className="empty-state__icon">{icon ?? <Sprout size={22} strokeWidth={1.75} />}</div>
      ) : null}
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__desc">{description}</p> : null}
      {action ? <div className={cn(compact ? 'mt-3' : 'mt-4')}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state rounded-[0.95rem] border border-[rgb(46_94_74/0.12)] bg-[linear-gradient(180deg,#ffffff_0%,#f7faf8_100%)] shadow-[var(--shadow-soft)]">
      <div className="empty-state__icon empty-state__icon--danger">
        <AlertTriangle size={22} strokeWidth={1.75} />
      </div>
      <p className="empty-state__title">Couldn’t load this data</p>
      <p className="empty-state__desc">{message}</p>
      {onRetry ? (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
