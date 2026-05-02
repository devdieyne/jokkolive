import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Bandeau "hors ligne" affiché en bas de l'écran (au-dessus de la bottom
 * nav) quand le navigateur perd la connexion. Disparait dès qu'elle revient.
 *
 * Pourquoi un bandeau plutôt qu'une page entière : l'app reste utilisable
 * en mode lecture (le SW sert le shell + les assets en cache). Couper
 * brutalement la nav serait pire UX que de signaler le souci passivement.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-4 md:bottom-4"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900/95 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
        <WifiOff className="h-4 w-4" />
        <span>Pas de connexion — certaines actions sont indisponibles</span>
      </div>
    </div>
  );
}
