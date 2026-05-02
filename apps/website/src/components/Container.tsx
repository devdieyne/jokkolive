import { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Container max-width responsive — utilise le même padding que le dashboard
 * pour la cohérence visuelle.
 */
export function Container({
  children,
  className,
  size = 'lg',
}: {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const max = {
    sm: 'max-w-3xl',
    md: 'max-w-5xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
  }[size];

  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', max, className)}>
      {children}
    </div>
  );
}
