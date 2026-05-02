import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { verifyMagicLink } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';

type Status =
  | { kind: 'verifying' }
  | { kind: 'error'; message: string }
  | { kind: 'login-done' };

/**
 * Page d'atterrissage du magic link envoyé par WhatsApp.
 *
 * Flow simplifié (inscription publique désactivée) :
 *  1. Récupère ?token=… dans l'URL
 *  2. POST /auth/magic/verify
 *  3. Set session via refreshAuth() puis redirect /
 *
 * Si le token est invalide/expiré/déjà utilisé OU si le compte n'existe
 * plus, on affiche un message d'erreur avec lien vers /login.
 */
export function MagicAuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<Status>({ kind: 'verifying' });

  useEffect(() => {
    if (!token) {
      setStatus({ kind: 'error', message: 'Lien invalide (token manquant).' });
      return;
    }
    let alive = true;
    verifyMagicLink(token)
      .then((res) => {
        if (!alive) return;
        refreshAuth(res.access_token, res.user);
        setStatus({ kind: 'login-done' });
        // Petit délai pour laisser voir le check vert
        setTimeout(() => navigate('/', { replace: true }), 600);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setStatus({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Lien invalide ou expiré.',
        });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-8 flex flex-col items-center">
        <Logo size="lg" withWordmark={false} />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        {status.kind === 'verifying' && (
          <div className="flex flex-col items-center py-6 text-center">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Vérification du lien…
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Un instant, on confirme votre identité.
            </p>
          </div>
        )}

        {status.kind === 'login-done' && (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-600" />
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Connexion réussie
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Redirection en cours…
            </p>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="flex flex-col items-center py-4 text-center">
            <h1 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
              Lien invalide
            </h1>
            <p className="mt-1.5 max-w-xs text-sm text-slate-500">
              {status.message}
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Les liens magiques expirent au bout de 10 minutes et sont à usage
              unique.
            </p>
            <div className="mt-6 flex w-full flex-col gap-2">
              <Link to="/login" className="block w-full">
                <Button fullWidth size="lg" variant="secondary">
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
