import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageCircle, Receipt, X } from 'lucide-react';
import { getMyOrders, updateOrder } from '../api/client';
import type { Order, OrderStatus } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { PageLoader } from '../components/ui/Spinner';
import { cn } from '../components/ui/cn';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_META: Record<
  OrderStatus,
  { label: string; tone: 'amber' | 'emerald' | 'slate' | 'rose' }
> = {
  pending: { label: 'En attente', tone: 'amber' },
  paid: { label: 'Payée', tone: 'emerald' },
  cancelled: { label: 'Annulée', tone: 'rose' },
  expired: { label: 'Expirée', tone: 'slate' },
};

type Filter = 'all' | OrderStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'paid', label: 'Payées' },
  { key: 'cancelled', label: 'Annulées' },
];

export function OrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', 'mine'],
    queryFn: getMyOrders,
  });
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: orders.length,
      pending: 0,
      paid: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const o of orders) c[o.status]++;
    return c;
  }, [orders]);

  const filtered = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  const handleStatus = async (o: Order, status: OrderStatus) => {
    await updateOrder(o._id, { status });
    await qc.invalidateQueries({ queryKey: ['orders', 'mine'] });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Commandes"
        description={
          <>
            Reçues via WhatsApp quand un client écrit{' '}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
              @pseudo:CODE
            </code>
            .
          </>
        }
      />

      {/* Filter tabs */}
      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card sm:min-w-0">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              {f.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={
            filter === 'all'
              ? 'Aucune commande pour le moment'
              : 'Aucune commande dans cette catégorie'
          }
          description={
            filter === 'all'
              ? 'Vos commandes apparaîtront ici dès qu\u2019un client écrira sur WhatsApp.'
              : 'Changez de filtre pour voir vos autres commandes.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const meta = STATUS_META[o.status];
            return (
              <article
                key={o._id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-pop sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="emerald" mono>
                        {o.productCode}
                      </Badge>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold leading-snug tracking-tight text-slate-900">
                      {o.productName}
                    </h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-semibold tracking-tight tabular-nums text-slate-900 sm:text-lg">
                      {o.totalAmount.toLocaleString('fr-FR')}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                      {o.currency}
                      {o.quantity > 1 && ` · qté ${o.quantity}`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {o.buyerName ?? 'Acheteur'}
                  </span>
                  <a
                    href={`https://wa.me/${o.buyerPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{o.buyerPhone}</span>
                  </a>
                  <span className="tabular-nums text-slate-400">
                    {formatDate(o.createdAt)}
                  </span>
                </div>

                {o.status === 'pending' && (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:flex sm:flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => void handleStatus(o, 'paid')}
                      leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    >
                      Marquer payée
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleStatus(o, 'cancelled')}
                      leftIcon={<X className="h-3.5 w-3.5" />}
                    >
                      Annuler
                    </Button>
                  </div>
                )}

                {o.status === 'paid' && o.paidAt && (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-emerald-700 tabular-nums">
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                    Payée le {formatDate(o.paidAt)}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
