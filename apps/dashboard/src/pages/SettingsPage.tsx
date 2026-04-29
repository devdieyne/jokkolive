import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, LogOut, Share2, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMe, updateCurrency, updatePayoutAccounts } from '../api/client';
import { SUPPORTED_CURRENCIES, type Currency } from '../types';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';

const CURRENCY_LABELS: Record<Currency, { flag: string; name: string }> = {
  XOF: { flag: '🌍', name: 'Franc CFA (BCEAO)' },
  XAF: { flag: '🌍', name: 'Franc CFA (BEAC)' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
  USD: { flag: '🇺🇸', name: 'Dollar US' },
  MAD: { flag: '🇲🇦', name: 'Dirham marocain' },
  GBP: { flag: '🇬🇧', name: 'Livre sterling' },
  CAD: { flag: '🇨🇦', name: 'Dollar canadien' },
  NGN: { flag: '🇳🇬', name: 'Naira' },
  GHS: { flag: '🇬🇭', name: 'Cedi' },
};

export function SettingsPage() {
  const { user, refreshAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [currency, setCurrencyValue] = useState<Currency>(
    user?.currency ?? 'XOF',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await updateCurrency(currency);
      refreshAuth(res.access_token, res.user);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Réglages"
        description="Gérez votre profil, votre devise et votre compte."
      />

      <div className="space-y-5">
        {/* Profil */}
        <Card noPadding>
          <CardHeader
            title="Profil"
            description="Informations associées à votre compte vendeur."
          />
          <div className="flex items-start gap-4 px-4 py-5 sm:px-5">
            <Avatar name={user.displayName} size="lg" />
            <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Nom de la boutique" value={user.displayName} />
              <Field label="Pseudo" value={`@${user.pseudo}`} mono />
              <Field label="Téléphone" value={user.phone} mono />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Rôle
                </p>
                <div className="mt-1">
                  <Badge tone={user.role === 'admin' ? 'violet' : 'emerald'}>
                    {user.role === 'admin' ? 'Administrateur' : 'Vendeur'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Devise */}
        <Card noPadding>
          <CardHeader
            title="Devise par défaut"
            description="Tous les nouveaux produits utiliseront cette devise. Le changement n'affecte pas les produits déjà créés."
          />
          <div className="space-y-4 px-4 py-5 sm:px-5">
            <Select
              label="Devise"
              value={currency}
              onChange={(e) => {
                setCurrencyValue(e.target.value as Currency);
                setSaved(false);
              }}
              disabled={saving}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c].flag} {c} — {CURRENCY_LABELS[c].name}
                </option>
              ))}
            </Select>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
              >
                {error}
              </div>
            )}
            {saved && !error && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Devise enregistrée
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => void handleSave()}
                loading={saving}
                disabled={currency === user.currency}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </Card>

        {/* Partage du profil */}
        <ShareProfileCard />

        {/* Comptes de retrait */}
        <PayoutAccountsCard />

        {/* Compte */}
        <Card noPadding>
          <CardHeader
            title="Compte"
            description="Déconnectez-vous de cet appareil."
          />
          <div className="px-4 py-5 sm:px-5">
            <Button
              variant="secondary"
              onClick={handleLogout}
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              Déconnexion
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ShareProfileCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);

  if (!user?.share) {
    // Pas de WHATSAPP_BUSINESS_NUMBER configuré côté API → on n'affiche pas
    // la card pour éviter d'exposer un lien cassé.
    return null;
  }

  const { link, prefilledMessage, whatsappNumber } = user.share;
  // Lien catalogue public — autonome (pas de WhatsApp Business requis)
  const shopLink = `${window.location.origin}/shop/${user.pseudo}`;

  const handleCopy = async (value: string, kind: 'link' | 'message') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // clipboard refusé (http?, navigateur ancien) — silencieux
    }
  };

  const handleNativeShare = async () => {
    const target = shopLink;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `Boutique @${user.pseudo} sur JokkoLive`,
          text: `Découvre les produits de @${user.pseudo} :`,
          url: target,
        });
        return;
      } catch {
        /* utilisateur a annulé */
      }
    }
    void handleCopy(target, 'message');
  };

  return (
    <Card noPadding>
      <CardHeader
        title="Partager ma boutique"
        description={`Diffusez ce lien sur vos réseaux. Vos clients ouvrent WhatsApp avec un message pré-rempli ; ils n'ont qu'à ajouter le code produit.`}
      />
      <div className="space-y-4 px-4 py-5 sm:px-5">
        {/* Aperçu du message tel qu'il apparaîtra à l'acheteur */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Aperçu du message
          </p>
          <p className="mt-2 font-mono text-sm text-slate-800">
            {prefilledMessage}
            <span className="text-slate-400">[code produit]</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sera envoyé sur {whatsappNumber}
          </p>
        </div>

        {/* Lien catalogue public */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Catalogue public
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Page publique listant tous tes produits actifs avec un bouton de
            commande WhatsApp.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
              {shopLink}
            </code>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void handleCopy(shopLink, 'message')}
                leftIcon={<Copy className="h-4 w-4" />}
              >
                {copied === 'message' ? 'Copié' : 'Copier'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(shopLink, '_blank', 'noopener')}
                leftIcon={<ExternalLink className="h-4 w-4" />}
              >
                Voir
              </Button>
            </div>
          </div>
        </div>

        {/* Lien wa.me direct */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Lien WhatsApp direct
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ouvre WhatsApp avec ton préfix prêt — l'acheteur n'a qu'à taper le
            code produit.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
              {link}
            </code>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void handleCopy(link, 'link')}
                leftIcon={<Copy className="h-4 w-4" />}
              >
                {copied === 'link' ? 'Copié' : 'Copier'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(link, '_blank', 'noopener')}
                leftIcon={<ExternalLink className="h-4 w-4" />}
              >
                Tester
              </Button>
            </div>
          </div>
        </div>

        {copied && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Lien copié dans le presse-papiers
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => void handleNativeShare()}
            leftIcon={<Share2 className="h-4 w-4" />}
          >
            Partager mon catalogue
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PayoutAccountsCard() {
  const { user, refreshAuth } = useAuth();
  const [wave, setWave] = useState(user?.payoutAccounts?.wave?.mobile ?? '');
  const [om, setOm] = useState(
    user?.payoutAccounts?.orangeMoney?.mobile ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Garde sync si le user change (ex. après /auth/me au boot)
  useEffect(() => {
    setWave(user?.payoutAccounts?.wave?.mobile ?? '');
    setOm(user?.payoutAccounts?.orangeMoney?.mobile ?? '');
  }, [user]);

  if (!user) return null;

  const isValid9 = (v: string) => /^[0-9]{9}$/.test(v);

  const dirty =
    (wave !== '' && wave !== (user.payoutAccounts?.wave?.mobile ?? '')) ||
    (om !== '' && om !== (user.payoutAccounts?.orangeMoney?.mobile ?? ''));

  const handleSave = async () => {
    setError('');
    setSaved(false);
    const payload: { wave?: { mobile: string }; orangeMoney?: { mobile: string } } = {};
    if (wave && wave !== (user.payoutAccounts?.wave?.mobile ?? '')) {
      if (!isValid9(wave)) {
        setError('Numéro Wave : 9 chiffres requis');
        return;
      }
      payload.wave = { mobile: wave };
    }
    if (om && om !== (user.payoutAccounts?.orangeMoney?.mobile ?? '')) {
      if (!isValid9(om)) {
        setError('Numéro Orange Money : 9 chiffres requis');
        return;
      }
      payload.orangeMoney = { mobile: om };
    }
    if (!payload.wave && !payload.orangeMoney) return;

    setSaving(true);
    try {
      await updatePayoutAccounts(payload);
      // Recharge le user pour refléter dans le context
      const me = await getMe();
      refreshAuth(me.access_token, me.user);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card noPadding>
      <CardHeader
        title="Comptes de retrait"
        description="Numéros mobile money utilisés pour recevoir vos paiements. Sénégal, 9 chiffres sans indicatif."
      />
      <div className="space-y-4 px-5 py-5">
        <Input
          label="Wave"
          inputMode="numeric"
          value={wave}
          maxLength={9}
          onChange={(e) => {
            setWave(e.target.value.replace(/[^0-9]/g, '').slice(0, 9));
            setSaved(false);
          }}
          placeholder="776583181"
          hint="Numéro Sénégalais à 9 chiffres"
          leftAddon={<Wallet className="h-4 w-4" />}
          disabled={saving}
        />
        <Input
          label="Orange Money"
          inputMode="numeric"
          value={om}
          maxLength={9}
          onChange={(e) => {
            setOm(e.target.value.replace(/[^0-9]/g, '').slice(0, 9));
            setSaved(false);
          }}
          placeholder="776583181"
          hint="Numéro Sénégalais à 9 chiffres"
          leftAddon={<Wallet className="h-4 w-4" />}
          disabled={saving}
        />

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        {saved && !error && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Comptes enregistrés
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!dirty}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm text-slate-800 ${mono ? 'font-mono tabular-nums' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
