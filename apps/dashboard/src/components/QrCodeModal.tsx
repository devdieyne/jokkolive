import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, QrCode } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { buildWhatsappLink } from '../lib/whatsapp';

interface QrCodeModalProps {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string | null;
  pseudo: string;
  productCode: string;
  productName: string;
}

/**
 * Modal d'affichage et téléchargement du QR d'un produit.
 *
 * Le QR encode un lien `wa.me` qui pré-remplit le message `@<pseudo>: <code>`.
 * L'acheteur scanne → WhatsApp s'ouvre → il n'a plus qu'à envoyer (zéro saisie).
 */
export function QrCodeModal({
  open,
  onClose,
  whatsappNumber,
  pseudo,
  productCode,
  productName,
}: QrCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const link = whatsappNumber
    ? buildWhatsappLink(whatsappNumber, pseudo, productCode)
    : '';

  // Génération du QR à l'ouverture
  useEffect(() => {
    if (!open || !canvasRef.current || !link) return;
    QRCode.toCanvas(
      canvasRef.current,
      link,
      {
        width: 320,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (err) setError('Impossible de générer le QR code');
      },
    );
  }, [open, link]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard refusé */
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `jokkolive-${pseudo}-${productCode}.png`;
    a.click();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`QR ${productCode}`}
      description={`Scan → WhatsApp s'ouvre avec « @${pseudo}: ${productCode} » prêt à envoyer.`}
      icon={<QrCode className="h-5 w-5" />}
    >
      {!whatsappNumber ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Le numéro WhatsApp public de la plateforme n'est pas configuré.
          Contacte l'administrateur pour générer des QR codes.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <strong>{productName}</strong> ({productCode})
          </p>

          {/* Canvas QR */}
          <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-4">
            <canvas
              ref={canvasRef}
              aria-label={`QR code pour commander ${productCode}`}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          {/* Lien wa.me */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Lien équivalent
            </p>
            <code className="mt-1 block truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {link}
            </code>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              variant="secondary"
              onClick={() => void handleCopy()}
              leftIcon={<Copy className="h-4 w-4" />}
            >
              {copied ? 'Copié' : 'Copier le lien'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open(link, '_blank', 'noopener')}
              leftIcon={<ExternalLink className="h-4 w-4" />}
            >
              Tester
            </Button>
            <Button
              onClick={handleDownload}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Télécharger
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
