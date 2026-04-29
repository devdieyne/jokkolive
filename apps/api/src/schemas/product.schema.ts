import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product> & {
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Produit d'un vendeur.
 *
 * Code unique par vendeur, dérivé d'un préfixe (ex: "R" pour robe, "C" pour
 * chemise) suivi d'une séquence auto-incrémentée par (sellerId, prefix).
 * Deux vendeurs distincts peuvent avoir tous les deux un produit "R1".
 *
 * Exemple : sellerId=abou, prefix=R → R1, R2, R3…
 */
@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  /** Préfixe en majuscules choisi par le vendeur (1-4 lettres : R, C, PAN…). */
  @Prop({
    required: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z]{1,4}$/,
  })
  prefix!: string;

  /** Séquence auto-incrémentée par (sellerId, prefix). 1, 2, 3… */
  @Prop({ required: true, min: 1 })
  seq!: number;

  /** Code dérivé = prefix + seq, ex: "R1". Stocké pour query directe. */
  @Prop({ required: true, uppercase: true })
  code!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  /** ISO 4217 — figé à la valeur de la devise du vendeur au moment de la création. */
  @Prop({ required: true })
  currency!: string;

  @Prop({ default: 0, min: 0 })
  stock!: number;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  imageUrl?: string;

  /** Désactivation soft (le code reste réservé). */
  @Prop({ default: false })
  disabled!: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Unicité du couple (sellerId, code) — empêche les doublons en cas de race
ProductSchema.index({ sellerId: 1, code: 1 }, { unique: true });
// Unicité de la séquence par (sellerId, prefix) — race condition guard
ProductSchema.index({ sellerId: 1, prefix: 1, seq: 1 }, { unique: true });
