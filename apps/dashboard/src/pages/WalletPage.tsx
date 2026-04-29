import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  Clock,
  RotateCcw,
  Wallet as WalletIcon,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getBalanceTransactions,
  getMyBalances,
  getMyPayouts,
  requestPayout,
} from '../api/client';
import type {
  BalanceTransaction,
  Payout,
  PayoutProvider,
  SellerBalance,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../components/ui/cn';

const PROVIDER_LABEL: Record<PayoutProvider, string> = {
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
};

const PROVIDER_ACCENT: Record<PayoutProvider, string> = {
  WAVE: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  ORANGE_MONEY: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

function formatXof(n: number): string {
  return n.toLocaleString('fr-FR');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function WalletPage() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<SellerBalance[] | null>(null);
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [waveTx, setWaveTx] = useState<BalanceTransaction[]>([]);
  const [omTx, setOmTx] = useState<BalanceTransaction[]>([]);
  const [tab, setTab] = useState<'movements' | 'payouts'>('movements');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payoutFor, setPayoutFor] = useState<PayoutProvider | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [bs, ps, wTx, oTx] = await Promise.all([
        getMyBalances(),
        getMyPayouts(50),
        getBalanceTransactions('WAVE', 50),
        getBalanceTransactions('ORANGE_MONEY', 50),
      ]);
      setBalances(bs);
      setPayouts(ps);
      setWaveTx(wTx);
      setOmTx(oTx);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transactions = useMemo(
    () =>
      [...waveTx, ...omTx].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [waveTx, omTx],
  );

  const accountFor = (p: PayoutProvider): string | undefined =>
    p === 'WAVE'
      ? user?.payoutAccounts?.wave?.mobile
      : user?.payoutAccounts?.orangeMoney?.mobile;

  const openPayout = (p: PayoutProvider) => {
    setPayoutFor(p);
    setPayoutAmount('');
    setPayoutError('');
  };

  const submitPayout = async () => {
    if (!payoutFor) return;
    const amt = parseInt(payoutAmount, 10);
    if (!Number.isInteger(amt) || amt <= 0) {
      setPayoutError('Montant invalide');
      return;
    }
    setPayoutLoading(true);
    setPayoutError('');
    try {
      await requestPayout(amt, payoutFor);
      setPayoutFor(null);
      await refresh();
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Portefeuille"
        description="Vos soldes Wave et Orange Money — retirez quand vous le souhaitez."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && !balances ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {(balances ?? []).map((b) => {
              const hasAccount = !!accountFor(b.provider);
              return (
                <Card key={b.provider} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                        PROVIDER_ACCENT[b.provider],
                      )}
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      {PROVIDER_LABEL[b.provider]}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {b.currency}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      Disponible
                    </p>
                    <p className="mt-1 font-semibold tracking-tight text-slate-900 tabular-nums">
                      <span className="text-3xl">{formatXof(b.available)}</span>{' '}
                      <span className="text-sm font-medium text-slate-500">
                        XOF
                      </span>
                    </p>
                  </div>
                  {b.pending > 0 && (
                    <p className="text-xs text-slate-500 tabular-nums">
                      <Clock className="mr-1 inline h-3 w-3 align-[-1px]" />
                      {formatXof(b.pending)} XOF en cours de retrait
                    </p>
                  )}
                  <Button
                    onClick={() => openPayout(b.provider)}
                    disabled={!hasAccount || b.available <= 0}
                    leftIcon={<ArrowUpCircle className="h-4 w-4" />}
                  >
                    Retirer
                  </Button>
                  {!hasAccount && (
                    <p className="text-xs text-slate-500">
                      Aucun numéro {PROVIDER_LABEL[b.provider]} configuré.{' '}
                      <Link
                        to="/settings"
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        Configurer
                      </Link>
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="mt-8">
            <div className="mb-4 inline-flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setTab('movements')}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                  tab === 'movements'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Mouvements
              </button>
              <button
                type="button"
                onClick={() => setTab('payouts')}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                  tab === 'payouts'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Retraits
              </button>
            </div>

            {tab === 'movements' && (
              <TransactionsList items={transactions} />
            )}
            {tab === 'payouts' && <PayoutsList items={payouts ?? []} />}
          </div>
        </>
      )}

      <Modal
        open={payoutFor !== null}
        onClose={() => setPayoutFor(null)}
        title={
          payoutFor
            ? `Retirer vers ${PROVIDER_LABEL[payoutFor]}`
            : 'Retirer'
        }
        description={
          payoutFor
            ? `Le montant sera envoyé vers le numéro ${PROVIDER_LABEL[payoutFor]} configuré.`
            : undefined
        }
        icon={<ArrowUpCircle className="h-5 w-5" />}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPayoutFor(null)}
              disabled={payoutLoading}
            >
              Annuler
            </Button>
            <Button onClick={() => void submitPayout()} loading={payoutLoading}>
              Confirmer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Montant (XOF)"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
            disabled={payoutLoading}
            placeholder="Ex. 5000"
          />
          {payoutFor && (
            <Input
              label="Numéro destinataire"
              value={accountFor(payoutFor) ?? ''}
              disabled
              hint={
                <>
                  Pour modifier,{' '}
                  <Link
                    to="/settings"
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    aller dans les réglages
                  </Link>
                </>
              }
            />
          )}
          {payoutError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {payoutError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function TransactionsList({ items }: { items: BalanceTransaction[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<WalletIcon className="h-5 w-5" />}
        title="Aucun mouvement"
        description="Les paiements reçus et les retraits apparaîtront ici."
      />
    );
  }
  return (
    <Card noPadding>
      <CardHeader title="Historique" description="Vos 50 derniers mouvements" />
      <ul className="divide-y divide-slate-100">
        {items.map((t) => {
          const isCredit = t.type === 'credit';
          const isReverse = t.type === 'reverse';
          const sign = isCredit || isReverse ? '+' : '−';
          const tone = isCredit
            ? 'text-emerald-700'
            : isReverse
              ? 'text-sky-700'
              : 'text-slate-700';
          const Icon = isCredit
            ? ArrowDownCircle
            : isReverse
              ? RotateCcw
              : ArrowUpCircle;
          return (
            <li key={t._id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset',
                  isCredit
                    ? 'bg-emerald-50 text-emerald-600 ring-emerald-600/10'
                    : isReverse
                      ? 'bg-sky-50 text-sky-600 ring-sky-600/10'
                      : 'bg-slate-100 text-slate-500 ring-slate-300',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {t.description}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {formatDate(t.createdAt)} · {PROVIDER_LABEL[t.provider]}
                </p>
              </div>
              <p
                className={cn(
                  'shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums',
                  tone,
                )}
              >
                {sign}
                {formatXof(t.amount)}{' '}
                <span className="text-[11px] font-medium text-slate-500">
                  XOF
                </span>
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function PayoutsList({ items }: { items: Payout[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ArrowUpCircle className="h-5 w-5" />}
        title="Aucun retrait"
        description="Vos demandes de retrait apparaîtront ici."
      />
    );
  }
  return (
    <Card noPadding>
      <CardHeader title="Retraits" description="Demandes de retrait" />
      <ul className="divide-y divide-slate-100">
        {items.map((p) => (
          <li key={p._id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
            <PayoutStatusIcon status={p.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                Vers {PROVIDER_LABEL[p.provider]} · {p.mobile}
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                {formatDate(p.createdAt)}
                {p.failureReason && ` · ${p.failureReason}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {formatXof(p.amount)} XOF
              </p>
              <PayoutStatusBadge status={p.status} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PayoutStatusIcon({ status }: { status: Payout['status'] }) {
  const map: Record<Payout['status'], { icon: typeof Clock; cls: string }> = {
    pending: {
      icon: Clock,
      cls: 'bg-amber-50 text-amber-600 ring-amber-600/10',
    },
    processing: {
      icon: Clock,
      cls: 'bg-amber-50 text-amber-600 ring-amber-600/10',
    },
    success: {
      icon: CheckCircle2,
      cls: 'bg-emerald-50 text-emerald-600 ring-emerald-600/10',
    },
    failed: {
      icon: XCircle,
      cls: 'bg-rose-50 text-rose-600 ring-rose-600/10',
    },
  };
  const { icon: Icon, cls } = map[status];
  return (
    <div
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset',
        cls,
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

function PayoutStatusBadge({ status }: { status: Payout['status'] }) {
  if (status === 'success') return <Badge tone="emerald">Réussi</Badge>;
  if (status === 'failed') return <Badge tone="rose">Échoué</Badge>;
  return <Badge tone="amber">En cours</Badge>;
}
