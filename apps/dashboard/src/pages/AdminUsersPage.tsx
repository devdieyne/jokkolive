import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Percent, Plus, Trash2, UserPlus } from 'lucide-react';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  setUserPlatformFee,
  clearUserPlatformFee,
} from '../api/client';
import { SUPPORTED_CURRENCIES, type Currency, type UserRecord } from '../types';
import { PhoneInput } from '../components/PhoneInput';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { PageLoader } from '../components/ui/Spinner';
import { Select } from '../components/ui/Select';
import { cn } from '../components/ui/cn';

interface UserFormData {
  phone: string;
  pseudo: string;
  displayName: string;
  role: 'admin' | 'seller';
  currency: Currency;
  disabled: boolean;
  /**
   * Frais plateforme (admin override). `useDefaultFee=true` → l'API utilise
   * les valeurs env globales (PLATFORM_FEE_FLAT/PERCENT). Sinon on envoie
   * le couple (feeFlat, feePercentDisplay/100).
   * Les inputs sont des strings pour cohabiter avec l'utilisateur qui peut
   * vider le champ pendant la saisie sans casser le state.
   */
  useDefaultFee: boolean;
  feeFlat: string;
  feePercentDisplay: string;
}

// Valeurs par défaut affichées en placeholder. Doivent matcher les env
// PLATFORM_FEE_FLAT / PLATFORM_FEE_PERCENT côté API (cf. .env.example).
const DEFAULT_FEE_FLAT_HINT = '50';
const DEFAULT_FEE_PERCENT_HINT = '2';

const emptyForm: UserFormData = {
  phone: '+221',
  pseudo: '',
  displayName: '',
  role: 'seller',
  currency: 'XOF',
  disabled: false,
  useDefaultFee: true,
  feeFlat: '',
  feePercentDisplay: '',
};

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditUser(u);
    setForm({
      phone: u.phone,
      pseudo: u.pseudo,
      displayName: u.displayName,
      role: u.role,
      currency: u.currency,
      disabled: u.disabled,
      useDefaultFee: !u.platformFee,
      feeFlat: u.platformFee ? String(u.platformFee.flat) : '',
      // Conversion décimal → % pour l'affichage (0.03 → "3")
      feePercentDisplay: u.platformFee
        ? String(+(u.platformFee.percent * 100).toFixed(4))
        : '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      if (editUser) {
        await updateUser(editUser.id, {
          displayName: form.displayName,
          role: form.role,
          currency: form.currency,
          disabled: form.disabled,
        });

        // Frais plateforme : compare l'état du form au state DB pour ne
        // taper l'API que si quelque chose a changé.
        const currentlyHasOverride = !!editUser.platformFee;
        if (form.useDefaultFee && currentlyHasOverride) {
          await clearUserPlatformFee(editUser.id);
        } else if (!form.useDefaultFee) {
          const flat = parseInt(form.feeFlat || '0', 10);
          const percentNum = parseFloat(form.feePercentDisplay || '0');
          if (
            Number.isNaN(flat) ||
            flat < 0 ||
            Number.isNaN(percentNum) ||
            percentNum < 0 ||
            percentNum > 100
          ) {
            throw new Error(
              'Frais invalides (flat ≥ 0 entier, % entre 0 et 100).',
            );
          }
          // % → décimal (3 → 0.03), arrondi à 4 décimales pour éviter les
          // float surprises type 0.030000000000000002.
          const percent = +(percentNum / 100).toFixed(4);
          await setUserPlatformFee(editUser.id, { flat, percent });
        }
      } else {
        await createUser({
          phone: form.phone,
          pseudo: form.pseudo.toLowerCase().trim(),
          displayName: form.displayName,
          role: form.role,
          currency: form.currency,
        });
      }
      await qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (!confirm(`Supprimer ${u.displayName} (@${u.pseudo}) ?`)) return;
    await deleteUser(u.id);
    await qc.invalidateQueries({ queryKey: ['users'] });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Gérez les vendeurs et administrateurs de la plateforme."
        action={
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Nouveau vendeur
          </Button>
        }
      />

      {users.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="Aucun utilisateur"
          description="Ajoutez votre premier vendeur pour commencer."
          action={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Nouveau vendeur
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vendeur
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Téléphone
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rôle
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Devise
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Créé le
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    'transition-colors hover:bg-slate-50/60',
                    u.disabled && 'opacity-60',
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {u.displayName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          @{u.pseudo}
                          {u.disabled && (
                            <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              désactivé
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs tabular-nums text-slate-600">
                    {u.phone}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={u.role === 'admin' ? 'violet' : 'emerald'}>
                      {u.role === 'admin' ? 'Admin' : 'Vendeur'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-xs font-medium tabular-nums text-slate-600">
                    {u.currency}
                  </td>
                  <td className="px-5 py-3 text-xs tabular-nums text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`Modifier ${u.displayName}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </button>
                      <button
                        onClick={() => void handleDelete(u)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Supprimer ${u.displayName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {users.map((u) => (
              <li
                key={u.id}
                className={cn('px-4 py-4', u.disabled && 'opacity-60')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.displayName} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {u.displayName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        @{u.pseudo}
                      </p>
                      <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">
                        {u.phone}
                      </p>
                    </div>
                  </div>
                  <Badge tone={u.role === 'admin' ? 'violet' : 'emerald'}>
                    {u.role}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {u.currency} ·{' '}
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => openEdit(u)}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => void handleDelete(u)}
                      className="font-medium text-slate-500 hover:text-rose-600"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editUser ? 'Modifier l\u2019utilisateur' : 'Nouveau vendeur'}
        description={editUser ? editUser.displayName : 'Créez un compte vendeur ou administrateur.'}
        icon={<UserPlus className="h-4 w-4" />}
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Annuler
            </Button>
            <Button onClick={() => void handleSubmit()} loading={saving}>
              {editUser ? 'Mettre à jour' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editUser && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Téléphone WhatsApp
                </label>
                <PhoneInput
                  value={form.phone}
                  onChange={(p) => setForm((f) => ({ ...f, phone: p }))}
                />
              </div>

              <Input
                label="Pseudo"
                placeholder="fatou"
                value={form.pseudo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pseudo: e.target.value }))
                }
                maxLength={20}
                className="lowercase"
              />
            </>
          )}

          <Input
            label="Nom affiché"
            placeholder="Boutique Fatou"
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
            maxLength={80}
          />

          <Select
            label="Rôle"
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                role: e.target.value as 'admin' | 'seller',
              }))
            }
          >
            <option value="seller">Vendeur</option>
            <option value="admin">Administrateur</option>
          </Select>

          <Select
            label="Devise"
            value={form.currency}
            onChange={(e) =>
              setForm((f) => ({ ...f, currency: e.target.value as Currency }))
            }
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          {editUser && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Percent className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-medium text-slate-700">
                  Frais plateforme
                </p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.useDefaultFee}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, useDefaultFee: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-sm text-slate-700">
                  Utiliser les valeurs par défaut
                  <span className="block text-xs text-slate-500">
                    Soit les frais env globaux ({DEFAULT_FEE_FLAT_HINT} XOF +{' '}
                    {DEFAULT_FEE_PERCENT_HINT}%).
                  </span>
                </span>
              </label>

              {!form.useDefaultFee && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Input
                    label="Frais fixes"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={DEFAULT_FEE_FLAT_HINT}
                    rightAddon={<span className="text-xs">XOF</span>}
                    value={form.feeFlat}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        feeFlat: e.target.value.replace(/[^0-9]/g, ''),
                      }))
                    }
                  />
                  <Input
                    label="Pourcentage"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder={DEFAULT_FEE_PERCENT_HINT}
                    rightAddon={<span className="text-xs">%</span>}
                    value={form.feePercentDisplay}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        feePercentDisplay: e.target.value.replace(/[^0-9.]/g, ''),
                      }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {editUser && (
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.disabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, disabled: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="text-sm text-slate-700">
                Désactiver ce compte
                <span className="block text-xs text-slate-500">
                  Le vendeur ne pourra plus se connecter.
                </span>
              </span>
            </label>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              {error}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
