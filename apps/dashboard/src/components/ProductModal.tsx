import { useState, FormEvent } from 'react';
import { Package, Pencil } from 'lucide-react';
import { createProduct, updateProduct } from '../api/client';
import type { Product } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface Props {
  onClose: () => void;
  onCreated: (p: Product) => void;
  /** Si fourni, le modal est en mode édition. */
  product?: Product;
}

export function ProductModal({ onClose, onCreated, product }: Props) {
  const isEdit = product !== undefined;

  const [name, setName] = useState(product?.name ?? '');
  const [prefix, setPrefix] = useState(product?.prefix ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let saved: Product;
      if (isEdit) {
        saved = await updateProduct(product._id, {
          name: name.trim(),
          price: Number(price),
          stock: Number(stock),
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        });
      } else {
        const cleanPrefix = prefix.toUpperCase().trim();
        if (!/^[A-Z]{1,4}$/.test(cleanPrefix)) {
          throw new Error('Le préfixe doit contenir 1 à 4 lettres');
        }
        saved = await createProduct({
          name: name.trim(),
          prefix: cleanPrefix,
          price: Number(price),
          stock: Number(stock),
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        });
      }
      onCreated(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Modifier le produit` : 'Nouveau produit'}
      description={
        isEdit ? product.name : 'Créez un produit que vos clients commanderont sur WhatsApp.'
      }
      icon={
        isEdit ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <Package className="h-4 w-4" />
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Annuler
          </Button>
          <Button
            type="submit"
            form="product-form"
            loading={saving}
          >
            {isEdit ? 'Enregistrer' : 'Créer le produit'}
          </Button>
        </>
      }
    >
      <form
        id="product-form"
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4"
      >
        <Input
          label="Nom du produit"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Robe wax rouge"
          maxLength={80}
        />

        {!isEdit && (
          <Input
            label="Préfixe du code"
            required
            value={prefix}
            onChange={(e) =>
              setPrefix(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())
            }
            placeholder="R"
            maxLength={4}
            className="font-mono uppercase tracking-wide"
            hint="1 à 4 lettres (ex : R pour Robe, C pour Chemise, PAN pour Pantalon). Le code complet sera attribué automatiquement (R1, R2, R3…)."
          />
        )}

        {isEdit && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5">
            <p className="text-xs text-emerald-800">
              Code attribué :{' '}
              <span className="font-mono font-semibold tabular-nums">
                {product.code}
              </span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              label={`Prix (${product?.currency ?? 'devise'})`}
              required
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="15000"
              className="tabular-nums"
            />
          </div>
          <Input
            label="Stock"
            required
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="tabular-nums"
          />
        </div>

        <div>
          <label
            htmlFor="prod-desc"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Description{' '}
            <span className="font-normal text-slate-400">(optionnel)</span>
          </label>
          <textarea
            id="prod-desc"
            rows={2}
            className="block w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Robe en wax 100% coton, taille M"
            maxLength={500}
          />
        </div>

        <Input
          label="URL de l'image"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          maxLength={500}
          hint="Optionnel — un visuel rend le produit plus attractif."
        />

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5"
          >
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
