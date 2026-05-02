import { AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

/**
 * Bouton-lien (toujours `<a>` car c'est un site marketing — pas de form).
 * Mêmes tokens visuels + active:scale-95 pour le feedback "haptic" mobile,
 * comme sur le dashboard.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: Props) {
  return (
    <a
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-all',
        'active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </a>
  );
}
