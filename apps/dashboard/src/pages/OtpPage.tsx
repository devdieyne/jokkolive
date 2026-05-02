import {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
  FormEvent,
} from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requestOtp, type OtpFallback } from '../api/client';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { cn } from '../components/ui/cn';

interface LocationState {
  phone?: string;
  mode?: 'login' | 'register';
  /** Lien wa.me "écrire LOGIN" affiché si l'OTP n'arrive pas. */
  fallback?: OtpFallback;
}

const RESEND_COOLDOWN_S = 60;
const OTP_LENGTH = 6;

export function OtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const phone = state.phone ?? '';
  const mode = state.mode ?? 'login';
  const [fallback, setFallback] = useState<OtpFallback | undefined>(
    state.fallback,
  );

  const { loginWithOtp } = useAuth();
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => ''),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Countdown pour le bouton "Renvoyer"
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Autofocus 1st box
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  if (!phone) {
    return <Navigate to="/login" replace />;
  }

  const code = digits.join('');

  const submitCode = async (fullCode: string) => {
    setError('');
    if (!/^\d{6}$/.test(fullCode)) {
      setError('Le code doit contenir 6 chiffres.');
      return;
    }
    setLoading(true);
    try {
      await loginWithOtp(phone, fullCode);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitCode(code);
  };

  const handleChange = (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigits((d) => {
        const next = [...d];
        next[idx] = '';
        return next;
      });
      return;
    }
    setDigits((d) => {
      const next = [...d];
      // If the user typed/pasted multiple digits, spread them
      for (let i = 0; i < raw.length && idx + i < OTP_LENGTH; i++) {
        next[idx + i] = raw[i];
      }
      return next;
    });
    const targetIdx = Math.min(idx + raw.length, OTP_LENGTH - 1);
    inputsRef.current[targetIdx]?.focus();

    // Auto-submit when complete
    const filled = [...digits];
    for (let i = 0; i < raw.length && idx + i < OTP_LENGTH; i++) {
      filled[idx + i] = raw[i];
    }
    if (filled.every((c) => c !== '') && filled.join('').length === OTP_LENGTH) {
      void submitCode(filled.join(''));
    }
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      e.preventDefault();
      setDigits((d) => {
        const next = [...d];
        next[idx - 1] = '';
        return next;
      });
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
      e.preventDefault();
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? '');
    setDigits(next);
    const lastFilled = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputsRef.current[Math.max(lastFilled, 0)]?.focus();
    if (pasted.length === OTP_LENGTH) void submitCode(pasted);
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      const res = await requestOtp(phone);
      if (res.fallback) setFallback(res.fallback);
      setInfo('Un nouveau code vient d\u2019être envoyé sur WhatsApp.');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du renvoi');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-8 flex flex-col items-center">
        <Logo size="lg" withWordmark={false} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Vérification du numéro
        </h1>
        <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
          Code à 6 chiffres envoyé sur WhatsApp au{' '}
          <span className="font-medium tabular-nums text-slate-700">{phone}</span>
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        {mode === 'register' && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3.5 py-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-emerald-800">
              Validez votre numéro pour activer votre compte vendeur.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Code de vérification
            </label>
            <div className="flex justify-between gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  aria-label={`Chiffre ${i + 1}`}
                  className={cn(
                    'h-12 w-full min-w-0 rounded-lg border bg-white text-center font-mono text-xl font-semibold tabular-nums text-slate-900 transition-colors',
                    'focus:outline-none focus:ring-2',
                    'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20',
                    'disabled:cursor-not-allowed disabled:bg-slate-50',
                  )}
                />
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              {error}
            </div>
          )}
          {info && (
            <div
              role="status"
              className="rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700"
            >
              {info}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            disabled={code.length !== OTP_LENGTH}
            fullWidth
            size="lg"
          >
            {loading ? 'Vérification…' : 'Valider le code'}
          </Button>
        </form>

        {fallback && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
                <MessageCircle className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-900">
                  Vous n'avez pas reçu le code ?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  Écrivez{' '}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                    {fallback.prefilledMessage}
                  </code>{' '}
                  sur WhatsApp au{' '}
                  <span className="font-medium tabular-nums">
                    {fallback.whatsappNumber}
                  </span>{' '}
                  : vous recevrez un lien de connexion sécurisé.
                </p>
                <a
                  href={fallback.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Ouvrir WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={cooldown > 0}
            className="text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          >
            {cooldown > 0
              ? `Renvoyer le code dans ${cooldown}s`
              : 'Renvoyer le code'}
          </button>
          <Link
            to="/login"
            className="text-xs text-slate-500 transition-colors hover:text-slate-700 hover:underline"
          >
            Changer de numéro
          </Link>
        </div>
      </div>
    </div>
  );
}
