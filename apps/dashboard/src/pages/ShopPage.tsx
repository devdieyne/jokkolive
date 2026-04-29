import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Package, QrCode, Store } from 'lucide-react';
import { getPublicShop, type PublicShop } from '../api/client';
import { Logo } from '../components/ui/Logo';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageLoader } from '../components/ui/Spinner';
import { QrCodeModal } from '../components/QrCodeModal';
import { buildWhatsappLink } from '../lib/whatsapp';
import type { Product } from '../types';

function formatPrice(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

/**
 * Catalogue public d'un vendeur — accessible sans authentification.
 *
 * URL : `/shop/:pseudo` (ex : `https://jokkolive.com/shop/admin`)
 *
 * UX cible : un acheteur arrive sur la page (via lien partagé / QR / réseaux),
 * voit les produits actifs, clique sur "Commander sur WhatsApp" → WhatsApp
 * s'ouvre avec un message pré-rempli `@<pseudo>: <code>`.
 */
export function ShopPage() {
  const { pseudo = '' } = useParams<{ pseudo: string }>();
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const { data, isLoading, error } = useQuery<PublicShop>({
    queryKey: ['publicShop', pseudo],
    queryFn: () => getPublicShop(pseudo),
    retry: false,
  });

  useEffect(() => {
    if (data?.seller) {
      document.title = `${data.seller.displayName} (@${data.seller.pseudo}) — JokkoLive`;
    }
    return () => {
      document.title = 'JokkoLive';
    };
  }, [data]);

  if (isLoading) return <PageLoader />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-md">
          <header className="mb-8 flex justify-center">
            <Link to="/">
              <Logo />
            </Link>
          </header>
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title="Boutique introuvable"
            description={`Aucune boutique "${pseudo}" n'a été trouvée. Vérifie l'URL.`}
          />
        </div>
      </div>
    );
  }

  const { seller, products, whatsappNumber } = data;
  const shopGenericLink = whatsappNumber
    ? buildWhatsappLink(whatsappNumber, seller.pseudo)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" aria-label="JokkoLive">
            <Logo />
          </Link>
          <Link
            to="/login"
            className="text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Espace vendeur
          </Link>
        </div>
      </header>

      {/* Hero vendeur */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Store className="h-4 w-4" />
            <span>Boutique JokkoLive</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {seller.displayName}
          </h1>
          <p className="mt-1 font-mono text-sm text-slate-500">
            @{seller.pseudo}
          </p>

          {shopGenericLink && (
            <div className="mt-5">
              <Button
                onClick={() =>
                  window.open(shopGenericLink, '_blank', 'noopener')
                }
                leftIcon={<MessageCircle className="h-4 w-4" />}
              >
                Écrire sur WhatsApp
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                Ouvre WhatsApp avec « @{seller.pseudo}: » prêt — tape juste le
                code du produit.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Produits */}
      <section className="mx-auto max-w-4xl px-4 py-8">
        {products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="Aucun produit pour le moment"
            description="Ce vendeur n'a pas encore publié de produit."
          />
        ) : (
          <>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
              {products.length} produit{products.length > 1 ? 's' : ''}{' '}
              disponible{products.length > 1 ? 's' : ''}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const orderLink = whatsappNumber
                  ? buildWhatsappLink(whatsappNumber, seller.pseudo, p.code)
                  : null;
                const inStock = p.stock > 0;

                return (
                  <article
                    key={p._id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-pop"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <Badge tone="emerald" mono>
                        {p.code}
                      </Badge>
                      {!inStock && <Badge tone="slate">Rupture</Badge>}
                    </div>

                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-slate-900">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-500">
                        {p.description}
                      </p>
                    )}

                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-lg font-semibold tracking-tight tabular-nums text-slate-900">
                        {formatPrice(p.price, p.currency)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-slate-100 pt-4">
                      <Button
                        size="sm"
                        disabled={!inStock || !orderLink}
                        onClick={() =>
                          orderLink &&
                          window.open(orderLink, '_blank', 'noopener')
                        }
                        leftIcon={<MessageCircle className="h-3.5 w-3.5" />}
                      >
                        Commander
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setQrProduct(p)}
                        aria-label="Voir le QR code"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-4xl border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
        <p>
          Propulsé par{' '}
          <Link to="/" className="font-semibold text-slate-700 hover:underline">
            JokkoLive
          </Link>
          {' · '}
          <Link to="/privacy" className="hover:underline">
            Confidentialité
          </Link>
          {' · '}
          <Link to="/terms" className="hover:underline">
            Conditions
          </Link>
        </p>
      </footer>

      <QrCodeModal
        open={qrProduct !== null}
        onClose={() => setQrProduct(null)}
        whatsappNumber={whatsappNumber}
        pseudo={seller.pseudo}
        productCode={qrProduct?.code ?? ''}
        productName={qrProduct?.name ?? ''}
      />
    </div>
  );
}
