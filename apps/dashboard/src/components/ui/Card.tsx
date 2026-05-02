import { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Removes the default padding (useful for tables / list rows). */
  noPadding?: boolean;
  /** Adds subtle hover state. */
  interactive?: boolean;
}

export function Card({
  children,
  noPadding,
  interactive,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        // Mobile : section "edge to edge" comme une grouped list iOS — pas
        // de bordure horizontale, pas de coin arrondi sur les côtés, pas
        // d'ombre. Les sections sont séparées par les filets horizontaux
        // (border-y) et l'espacement vertical du parent.
        'border-y border-slate-200 bg-white',
        // Desktop (sm+) : on retrouve la card classique flottante.
        'sm:rounded-xl sm:border sm:shadow-card',
        !noPadding && 'p-5',
        interactive &&
          'transition-all active:bg-slate-50 sm:hover:shadow-pop sm:hover:border-slate-300',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
