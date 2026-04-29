import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from './cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, hint, error, className, id, children, ...rest }, ref) {
    const selectId =
      id ??
      (label ? `sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'block w-full appearance-none rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 transition-colors',
              'focus:outline-none focus:ring-2',
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20',
              'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
              className,
            )}
            {...rest}
          >
            {children}
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m6 8 4 4 4-4"
              />
            </svg>
          </span>
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-rose-600">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{hint}</p>
        ) : null}
      </div>
    );
  },
);
