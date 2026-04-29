import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { register as apiRegister } from '../api/client';
import { PhoneInput } from '../components/PhoneInput';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Logo } from '../components/ui/Logo';

export function RegisterPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('+221');
  const [pseudo, setPseudo] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError('Numéro invalide. Format attendu : +221XXXXXXXXX');
      return;
    }
    const cleanPseudo = pseudo.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanPseudo)) {
      setError(
        'Pseudo invalide : 3 à 20 caractères, minuscules, chiffres ou underscore.',
      );
      return;
    }
    if (displayName.trim().length < 2) {
      setError('Nom affiché trop court (min 2 caractères).');
      return;
    }

    setLoading(true);
    try {
      await apiRegister({
        phone,
        pseudo: cleanPseudo,
        displayName: displayName.trim(),
      });
      navigate('/otp', { state: { phone, mode: 'register' } });
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
          Créer un compte vendeur
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Démarrez votre boutique WhatsApp en moins d'une minute.
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
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
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              C'est par ce numéro que vos clients vous écriront.
            </p>
          </div>

          <Input
            label="Pseudo public"
            type="text"
            required
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            disabled={loading}
            placeholder="abou"
            maxLength={20}
            className="lowercase"
            hint={
              <>
                Vos clients écriront{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                  @{pseudo || 'pseudo'}:R1
                </code>{' '}
                pour acheter.
              </>
            }
          />

          <Input
            label="Nom de votre boutique"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            placeholder="Boutique Abou"
            maxLength={80}
          />

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
            {loading ? 'Création du compte…' : 'Continuer'}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Déjà inscrit ?{' '}
        <Link
          to="/login"
          className="font-medium text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
