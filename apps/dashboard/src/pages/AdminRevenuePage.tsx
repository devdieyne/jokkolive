import { useQuery } from '@tanstack/react-query';
import { Coins, Receipt, TrendingUp, Trophy } from 'lucide-react';
import { getAdminRevenue, type RevenueBucket } from '../api/client';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { PageLoader } from '../components/ui/Spinner';

function formatXof(n: number): string {
  return n.toLocaleString('fr-FR');
}

function BucketCard({
  label,
  bucket,
  highlight,
}: {
  label: string;
  bucket: RevenueBucket;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border p-4 ${
        highlight
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-slate-900">
        {formatXof(bucket.totalFee)}{' '}
        <span className="text-sm font-medium text-slate-400">XOF</span>
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {bucket.count} paiement{bucket.count > 1 ? 's' : ''} ·{' '}
        {formatXof(bucket.totalGross)} XOF brut
      </p>
    </div>
  );
}

export function AdminRevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'revenue'],
    queryFn: getAdminRevenue,
    // Bénéfices ne changent pas vite — on évite de re-fetcher toutes les 10s.
    staleTime: 60_000,
  });

  if (isLoading) return <PageLoader />;
  if (!data) {
    return (
      <div>
        <PageHeader title="Bénéfices plateforme" />
        <EmptyState
          icon={<Coins className="h-8 w-8" />}
          title="Aucune donnée"
          description="Les statistiques apparaîtront dès le premier paiement."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="px-4 sm:px-0">
        <PageHeader
          title="Bénéfices plateforme"
          description="Frais collectés sur l'ensemble des paiements confirmés."
        />
      </div>

      {/* Buckets temporels */}
      <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:gap-4 sm:px-0">
        <BucketCard label="Aujourd'hui" bucket={data.today} highlight />
        <BucketCard label="7 derniers jours" bucket={data.last7d} />
        <BucketCard label="30 derniers jours" bucket={data.last30d} />
        <BucketCard label="Total" bucket={data.allTime} />
      </div>

      {/* Top vendeurs */}
      <Card noPadding>
        <CardHeader
          title="Top vendeurs (all-time)"
          description="Vendeurs ayant généré le plus de frais plateforme."
        />
        {data.topSellers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Pas encore de paiement confirmé.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.topSellers.map((s, i) => (
              <div
                key={s.sellerId}
                className="flex items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {i === 0 ? (
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    i + 1
                  )}
                </span>
                <Avatar name={s.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {s.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    @{s.pseudo} · {s.count} paiement{s.count > 1 ? 's' : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatXof(s.totalFee)}{' '}
                  <span className="text-xs text-slate-400">XOF</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Légende */}
      <div className="flex items-start gap-2.5 px-4 text-xs text-slate-500 sm:px-0">
        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          <Receipt className="mr-1 inline h-3.5 w-3.5" />
          Les frais sont calculés à la confirmation du paiement (
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
            PaymentLink.platformFee
          </code>
          ). Chaque vendeur peut avoir un taux personnalisé configuré par
          l'admin (cf. Utilisateurs).
        </p>
      </div>
    </div>
  );
}
