import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserRole = 'admin' | 'seller';

export type UserDocument = HydratedDocument<User> & {
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Devises ISO 4217 supportées (extensible).
 * XOF = FCFA (West African CFA franc) — devise par défaut.
 */
export const SUPPORTED_CURRENCIES = [
  'XOF', // FCFA
  'XAF', // CFA Afrique Centrale
  'EUR',
  'USD',
  'MAD',
  'GBP',
  'CAD',
  'NGN',
  'GHS',
] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

@Schema({ timestamps: true })
export class User {
  /** Numéro WhatsApp au format E.164 (ex: +221776583181). Identité unique. */
  @Prop({ required: true, unique: true, trim: true })
  phone!: string;

  /** Pseudo unique sur la plateforme, en minuscules, [a-z0-9_] (3-20 chars). */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  pseudo!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ required: true, enum: ['admin', 'seller'], default: 'seller' })
  role!: UserRole;

  /** Devise par défaut du vendeur (ISO 4217). FCFA par défaut. */
  @Prop({ required: true, enum: SUPPORTED_CURRENCIES, default: 'XOF' })
  currency!: Currency;

  /** Désactivation par admin (le user reste mais ne peut plus se connecter). */
  @Prop({ default: false })
  disabled!: boolean;

  /**
   * Comptes mobile money configurés pour les retraits.
   * `mobile` = 9 chiffres locaux (sans indicatif), Sénégal pour l'instant.
   */
  @Prop({
    type: {
      wave: { mobile: { type: String } },
      orangeMoney: { mobile: { type: String } },
    },
    _id: false,
  })
  payoutAccounts?: {
    wave?: { mobile: string };
    orangeMoney?: { mobile: string };
  };

  /**
   * Retrait automatique : à chaque paiement reçu, l'API tente de virer
   * directement le net (montant - frais plateforme) vers le compte mobile
   * money correspondant au provider du paiement (Wave → wave.mobile,
   * OrangeMoney → orangeMoney.mobile).
   *
   * En cas d'échec PSP, l'argent reste dans le solde disponible et le
   * vendeur peut faire un retrait manuel — il reçoit aussi une notif
   * WhatsApp et l'admin est averti.
   */
  @Prop({ default: false })
  autoPayoutEnabled!: boolean;

  /**
   * Override admin des frais plateforme pour ce vendeur.
   * Si `undefined` → on retombe sur les valeurs env `PLATFORM_FEE_FLAT` et
   * `PLATFORM_FEE_PERCENT` (défaut 50 XOF + 2%).
   *
   * `flat` est en FCFA (entier ≥ 0).
   * `percent` est un décimal entre 0 et 1 (ex: 0.03 pour 3%).
   * Les deux champs sont co-définis : si l'admin pose un override, il
   * fournit les deux valeurs. Pour revenir au défaut → DELETE l'override.
   */
  @Prop({
    type: {
      flat: { type: Number },
      percent: { type: Number },
    },
    _id: false,
  })
  platformFee?: {
    flat: number;
    percent: number;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
