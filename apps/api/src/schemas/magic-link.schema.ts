import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MagicLinkDocument = HydratedDocument<MagicLink> & {
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lien magique de connexion déclenché par un message WhatsApp entrant.
 *
 * Flow : user envoie "LOGIN" → webhook crée un MagicLink → API répond avec
 * une URL contenant le `token` → user clique → /auth/magic/verify consomme
 * le token et retourne un AuthResponse.
 *
 * Note : l'inscription publique étant désactivée (admin-only), un magic
 * link n'est généré QUE si le user existe déjà en base. Pas de mode signup.
 *
 * TTL Mongo : doc supprimé automatiquement à `expiresAt`.
 */
@Schema({ timestamps: true })
export class MagicLink {
  /**
   * Hash SHA-256 du token plain envoyé au user. On stocke le hash pour
   * qu'un dump Mongo ne donne pas de tokens utilisables.
   */
  @Prop({ required: true, unique: true, index: true })
  token!: string;

  /** Numéro E.164 du user (résolu depuis le wa_id Cloud). */
  @Prop({ required: true, index: true })
  phone!: string;

  /** Nom de profil WhatsApp (informatif, utile pour les logs). */
  @Prop()
  whatsappName?: string;

  @Prop({ required: true })
  expiresAt!: Date;

  /** Mis à true après consommation pour empêcher la réutilisation. */
  @Prop({ default: false })
  consumed!: boolean;
}

export const MagicLinkSchema = SchemaFactory.createForClass(MagicLink);

MagicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
