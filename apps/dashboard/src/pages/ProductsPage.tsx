import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  EyeOff,
  Eye,
  Package,
  Pencil,
  Plus,
  QrCode,
  Trash2,
} from 'lucide-react';
import { getMyProducts, deleteProduct, updateProduct } from '../api/client';
import { ProductModal } from '../components/ProductModal';
import { QrCodeModal } from '../components/QrCodeModal';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { PageLoader } from '../components/ui/Spinner';
import { cn } from '../components/ui/cn';

function formatPrice(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

export function ProductsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingStock, setEditingStock] = useState<Product | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', 'mine'],
    queryFn: getMyProducts,
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await deleteProduct(id);
    await qc.invalidateQueries({ queryKey: ['products', 'mine'] });
  };

  const handleUpdateStock = async (p: Product) => {
    const n = Number(stockValue);
    if (isNaN(n) || n < 0) return;
    await updateProduct(p.id, { stock: n });
    setEditingStock(null);
    await qc.invalidateQueries({ queryKey: ['products', 'mine'] });
  };

  const handleToggleDisabled = async (p: Product) => {
    await updateProduct(p.id, { disabled: !p.disabled });
    await qc.invalidateQueries({ queryKey: ['products', 'mine'] });
  };

  const handleCopyCommand = async (p: Product) => {
    if (!user) return;
    const command = `@${user.pseudo}:${p.code}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(p.id);
      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1800);
    } catch {
      /* ignore */
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Produits"
        description={
          user ? (
            <>
              <span className="font-medium text-slate-700">@{user.pseudo}</span>{' '}
              · vos clients écrivent{' '}
              <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                @{user.pseudo}:CODE
              </code>{' '}
              sur WhatsApp pour commander.
            </>
          ) : undefined
        }
        action={
          <Button
            onClick={() => setShowCreate(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Ajouter un produit
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Aucun produit pour le moment"
          description="Créez votre premier produit. Il recevra automatiquement un code court (R1, C1, …) que vos clients utiliseront pour commander."
          action={
            <Button
              onClick={() => setShowCreate(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Créer un produit
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <article
              key={p.id}
              className={cn(
                'group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-pop',
                p.disabled && 'opacity-70',
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <Badge tone="emerald" mono>
                  {p.code}
                </Badge>
                {p.disabled && <Badge tone="slate">Désactivé</Badge>}
              </div>

              <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-slate-900">
                {p.name}
              </h3>
              {p.description && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {p.description}
                </p>
              )}

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-lg font-semibold tracking-tight tabular-nums text-slate-900">
                  {formatPrice(p.price, p.currency)}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-slate-500">Stock :</span>
                {editingStock?.id === p.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      className="h-7 w-20 rounded-md border border-slate-300 px-2 text-xs tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={stockValue}
                      onChange={(e) => setStockValue(e.target.value)}
                      autoFocus
                    />
                    <button
                      onClick={() => void handleUpdateStock(p)}
                      className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50"
                      aria-label="Valider"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setEditingStock(p);
                      setStockValue(String(p.stock));
                    }}
                    className="font-semibold tabular-nums text-slate-700 hover:text-emerald-700 hover:underline"
                  >
                    {p.stock}
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleCopyCommand(p)}
                  leftIcon={
                    copied === p.id ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {copied === p.id ? 'Copié' : 'Copier'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setQrProduct(p)}
                  leftIcon={<QrCode className="h-3.5 w-3.5" />}
                >
                  QR code
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                <button
                  onClick={() => setEditing(p)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modifier</span>
                  <span className="sm:hidden">Éditer</span>
                </button>
                <button
                  onClick={() => void handleToggleDisabled(p)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  {p.disabled ? (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Réactiver
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      Masquer
                    </>
                  )}
                </button>
                <button
                  onClick={() => void handleDelete(p.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate && (
        <ProductModal
          onClose={() => setShowCreate(false)}
          onCreated={() =>
            qc.invalidateQueries({ queryKey: ['products', 'mine'] })
          }
        />
      )}
      {editing && (
        <ProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onCreated={() =>
            qc.invalidateQueries({ queryKey: ['products', 'mine'] })
          }
        />
      )}

      <QrCodeModal
        open={qrProduct !== null}
        onClose={() => setQrProduct(null)}
        whatsappNumber={user?.share?.whatsappNumber ?? null}
        pseudo={user?.pseudo ?? ''}
        productCode={qrProduct?.code ?? ''}
        productName={qrProduct?.name ?? ''}
      />
    </div>
  );
}
