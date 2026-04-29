import { cn } from './cn';

interface LogoProps {
  /** Whether to show the wordmark next to the icon. */
  withWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Force light mode rendering on dark bg (wordmark blanc). */
  variant?: 'default' | 'onDark';
  className?: string;
}

const ICON_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-7 w-7 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
  xl: 'h-16 w-16 rounded-2xl',
};

const WORD_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

/**
 * Logo JokkoLive — monogramme « J » + point Live.
 *
 * Symbolique :
 *  - J stylisé = JokkoLive, géométrique, lisible à toute taille
 *  - point ambre = signal "Live" / vivacité (Sénégal)
 *  - vert émeraude = devise africaine (XOF), confiance, finance
 */
export function Logo({
  withWordmark = true,
  size = 'md',
  variant = 'default',
  className,
}: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm ring-1 ring-emerald-700/20',
          ICON_SIZE[size],
        )}
        aria-hidden
      >
        <svg
          viewBox="0 0 64 64"
          className="h-full w-full"
          fill="none"
          aria-hidden
        >
          {/* Subtle top sheen for premium feel */}
          <rect
            width="64"
            height="64"
            fill="url(#logo-sheen)"
            fillOpacity="0.12"
          />
          {/* Letter J: vertical stroke + bottom hook */}
          <path
            d="M40 16 V40 a8 8 0 0 1 -8 8 h-4"
            stroke="#ffffff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Live indicator dot */}
          <circle cx="50" cy="16" r="4" fill="url(#logo-dot)" />
          <defs>
            <linearGradient
              id="logo-sheen"
              x1="0"
              y1="0"
              x2="0"
              y2="64"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#ffffff" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="logo-dot"
              x1="46"
              y1="12"
              x2="54"
              y2="20"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {withWordmark && (
        <span
          className={cn(
            'font-bold tracking-tight',
            variant === 'onDark' ? 'text-white' : 'text-slate-900',
            WORD_SIZE[size],
          )}
        >
          JokkoLive
        </span>
      )}
    </div>
  );
}
