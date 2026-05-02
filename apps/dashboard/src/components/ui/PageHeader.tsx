import { ReactNode } from 'react';
import { cn } from './cn';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        // px-4 sur mobile : sur l'app PWA / mobile, le main est en `px-0`
        // pour permettre aux cards d'aller bord-à-bord (look iOS grouped
        // list). Mais le titre/description doivent rester indentés —
        // sinon le texte est collé au bord de l'écran.
        'mb-6 flex flex-col gap-3 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-0',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {description && (
          <div className="mt-1 text-sm leading-relaxed text-slate-500">
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
