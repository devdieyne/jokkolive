import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/Button';

/**
 * Event Chrome/Edge/Android — apparaît quand l'app est installable.
 * Standard pas implémenté côté Safari iOS, qui passe par un "Ajouter à
 * l'écran d'accueil" manuel via le menu Partager.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'jokkolive_install_prompt_dismissed_at';
const DISMISS_COOLDOWN_DAYS = 14;
const VISIT_COUNT_KEY = 'jokkolive_visit_count';
// Seuil bas (1) pour que le prompt apparaisse dès la 1re visite après
// installation du SW. À remonter à 3 plus tard si jugé trop intrusif.
const MIN_VISITS_BEFORE_PROMPT = 1;

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPhone/iPod : userAgent contient le mot.
  // iPad iPadOS 13+ : se déguise en macOS desktop, on détecte via maxTouchPoints.
  if (/iphone|ipod/i.test(navigator.userAgent)) return true;
  if (/ipad/i.test(navigator.userAgent)) return true;
  return (
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  );
}

/**
 * Mode debug : `?install=force` dans l'URL force l'affichage du prompt même
 * si l'app est déjà installée / déjà dismissée / pas encore visitée 3 fois.
 * Utile pour tester sur appareil sans avoir à reset le localStorage.
 */
function isForced(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('install') === 'force';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari pré-iOS 17
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function wasRecentlyDismissed(): boolean {
  const ts = localStorage.getItem(STORAGE_KEY);
  if (!ts) return false;
  const ageDays = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
  return ageDays < DISMISS_COOLDOWN_DAYS;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () =>
      // L'event a peut-être été capturé par main.tsx avant que ce composant
      // ne se monte — on le récupère ici si présent.
      (window.__pwaInstallEvent as BeforeInstallPromptEvent | undefined) ??
      null,
  );
  const [show, setShow] = useState(false);
  const ios = isIos();

  useEffect(() => {
    const forced = isForced();
    if (!forced) {
      if (isStandalone()) return;
      if (wasRecentlyDismissed()) return;

      // Compteur de visites
      const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? '0', 10);
      localStorage.setItem(VISIT_COUNT_KEY, String(visits + 1));
      if (visits + 1 < MIN_VISITS_BEFORE_PROMPT) return;
    }

    // Si l'event a déjà été capturé par main.tsx → afficher tout de suite
    if (deferred) {
      setShow(true);
    }

    // Sinon, écouter l'event custom dispatché par main.tsx quand il arrive
    const onInstallable = () => {
      const e = window.__pwaInstallEvent as
        | BeforeInstallPromptEvent
        | undefined;
      if (e) {
        setDeferred(e);
        setShow(true);
      }
    };
    window.addEventListener('pwa:installable', onInstallable);

    // iOS : pas d'event natif, on affiche directement les instructions
    if (ios) setShow(true);

    return () => window.removeEventListener('pwa:installable', onInstallable);
  }, [ios, deferred]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
  };

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setShow(false);
    } else {
      handleDismiss();
    }
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Installer JokkoLive"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-pop animate-fade-in md:bottom-6"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
          <Download className="h-5 w-5 text-emerald-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Installer JokkoLive
          </p>
          {ios ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Appuyez sur{' '}
              <span aria-label="bouton Partager" className="font-medium">
                Partager
              </span>{' '}
              en bas, puis{' '}
              <span className="font-medium">« Sur l'écran d'accueil »</span>.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Accédez à votre boutique en 1 clic depuis votre écran d'accueil.
            </p>
          )}
          {!ios && deferred && (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => void handleInstall()}
            >
              Installer
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fermer"
          className="-m-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
