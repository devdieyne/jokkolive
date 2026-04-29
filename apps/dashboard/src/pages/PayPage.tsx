import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  XCircle,
} from 'lucide-react';
import { getPublicPaymentLink, initiateCheckout } from '../api/client';
import type { PayoutProvider, PublicPaymentLink } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { Spinner } from '../components/ui/Spinner';
import type { ReactNode } from 'react';

type Status = PublicPaymentLink['status'];

interface StatusMeta {
  label: string;
  tone: 'amber' | 'emerald' | 'rose' | 'slate';
  title: string;
  subtitle: string;
  icon: ReactNode;
}

const STATUS_META: Record<Status, StatusMeta> = {
  pending: {
    label: 'En attente',
    tone: 'amber',
    title: 'Choisissez votre moyen de paiement',
    subtitle:
      'Le paiement est sécurisé et confirmé instantanément après validation.',
    icon: <Clock className="h-6 w-6" />,
  },
  paid: {
    label: 'Payée',
    tone: 'emerald',
    title: 'Paiement confirmé',
    subtitle:
      'Le vendeur a bien reçu votre paiement. Merci pour votre commande !',
    icon: <CheckCircle2 className="h-6 w-6" />,
  },
  expired: {
    label: 'Expirée',
    tone: 'slate',
    title: 'Lien expiré',
    subtitle:
      'Ce lien n\u2019est plus valide. Renvoyez un message au vendeur pour générer une nouvelle commande.',
    icon: <AlertCircle className="h-6 w-6" />,
  },
  cancelled: {
    label: 'Annulée',
    tone: 'rose',
    title: 'Commande annulée',
    subtitle: 'Cette commande a été annulée par le vendeur.',
    icon: <XCircle className="h-6 w-6" />,
  },
};

const TONE_BG: Record<StatusMeta['tone'], string> = {
  amber: 'bg-amber-50 text-amber-600 ring-amber-600/10',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/10',
  rose: 'bg-rose-50 text-rose-600 ring-rose-600/10',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};

export function PayPage() {
  const { token } = useParams<{ token: string }>();
  const [link, setLink] = useState<PublicPaymentLink | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] =
    useState<PayoutProvider | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getPublicPaymentLink(token)
      .then(setLink)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Lien introuvable'),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async (provider: PayoutProvider) => {
    if (!token) return;
    setCheckoutLoading(provider);
    setCheckoutError('');
    try {
      const res = await initiateCheckout(token, provider);
      window.location.href = res.paymentUrl;
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : 'Impossible de démarrer le paiement',
      );
      setCheckoutLoading(null);
    }
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-slate-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center">
            <Logo size="md" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" label="Chargement…" />
              </div>
            )}

            {error && (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-600/10">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  Lien introuvable
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">{error}</p>
              </div>
            )}

            {link &&
              (() => {
                const meta = STATUS_META[link.status];
                return (
                  <div>
                    <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-white px-6 pb-8 pt-10 text-center">
                      <div
                        className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${TONE_BG[meta.tone]}`}
                      >
                        {meta.icon}
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Montant à payer
                      </p>
                      <p className="mt-2 font-semibold tracking-tight text-slate-900 tabular-nums">
                        <span className="text-5xl sm:text-4xl">
                          {link.amount.toLocaleString('fr-FR')}
                        </span>{' '}
                        <span className="text-base font-medium text-slate-500">
                          {link.currency}
                        </span>
                      </p>
                      <div className="mt-4 flex justify-center">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                    </div>

                    <div className="px-6 py-6 text-center">
                      <h2 className="text-base font-semibold tracking-tight text-slate-900">
                        {meta.title}
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                        {meta.subtitle}
                      </p>

                      {link.status === 'pending' && (
                        <>
                          <div className="mt-5 grid gap-2.5">
                            <Button
                              type="button"
                              fullWidth
                              size="lg"
                              loading={checkoutLoading === 'WAVE'}
                              disabled={checkoutLoading !== null}
                              onClick={() => void handlePay('WAVE')}
                            >
                              Payer avec Wave
                            </Button>
                            <Button
                              type="button"
                              fullWidth
                              size="lg"
                              variant="secondary"
                              loading={checkoutLoading === 'ORANGE_MONEY'}
                              disabled={checkoutLoading !== null}
                              onClick={() => void handlePay('ORANGE_MONEY')}
                            >
                              Payer avec Orange Money
                            </Button>
                          </div>
                          {checkoutError && (
                            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                              {checkoutError}
                            </p>
                          )}
                          <p className="mt-3 text-xs text-slate-400 tabular-nums">
                            Lien valable jusqu'au{' '}
                            {new Date(link.expiresAt).toLocaleString('fr-FR')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />
            Propulsé par{' '}
            <span className="font-semibold text-slate-600">JokkoLive</span>
          </p>
        </div>
      </div>
    </div>
  );
}
