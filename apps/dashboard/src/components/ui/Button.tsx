import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-600/60 focus-visible:ring-emerald-500/30',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 focus-visible:ring-slate-300',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60 focus-visible:ring-slate-300',
  danger:
    'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-600/60 focus-visible:ring-rose-500/30',
};

// Cibles tactiles ≥ 44px (Apple HIG) sur mobile : md=44px, lg=48px.
// Sur desktop on revient à des hauteurs plus compactes pour densité info.
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-11 px-4 text-sm sm:h-10',
  lg: 'h-12 px-5 text-sm sm:h-11',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-all',
        // Feedback "tap" haptic-feel : le bouton se compresse légèrement
        // sous le doigt comme dans une vraie app native.
        'active:scale-[0.97]',
        'focus:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
