import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { requestOtp } from '../api/client';
import { PhoneInput } from '../components/PhoneInput';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';

export function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('+221');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError('Numéro invalide. Format attendu : +221XXXXXXXXX');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(phone);
      navigate('/otp', { state: { phone, mode: 'login' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-8 flex flex-col items-center">
        <Logo size="lg" withWordmark={false} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Bienvenue sur JokkoLive
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vendez sur WhatsApp en 2 clics.
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div className="mb-6">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Connexion
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Entrez votre numéro WhatsApp pour recevoir un code de vérification.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Numéro WhatsApp
            </label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {loading ? 'Envoi du code…' : 'Recevoir un code'}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Pas encore de compte ?{' '}
        <Link
          to="/register"
          className="font-medium text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
