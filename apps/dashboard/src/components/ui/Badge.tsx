import { ReactNode } from 'react';
import { cn } from './cn';

type Tone =
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'sky'
  | 'violet'
  | 'neutral';

const TONES: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  neutral: 'bg-white text-slate-700 ring-slate-300',
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  /** Make text monospace + tabular for codes like R1, C2... */
  mono?: boolean;
}

export function Badge({
  tone = 'slate',
  children,
  className,
  mono,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        mono && 'font-mono tabular-nums tracking-tight',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
