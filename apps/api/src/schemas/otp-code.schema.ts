import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OtpCodeDocument = HydratedDocument<OtpCode> & {
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Code OTP envoyé par WhatsApp. On stocke uniquement le hash bcrypt
 * pour ne pas exposer le code en clair en cas de fuite Mongo.
 *
 * TTL Mongo : le doc est supprimé automatiquement à `expiresAt`.
 */
@Schema({ timestamps: true })
export class OtpCode {
  /** Numéro destinataire (E.164). */
  @Prop({ required: true, index: true })
  phone!: string;

  /** Hash bcrypt du code 6 chiffres. */
  @Prop({ required: true })
  codeHash!: string;

  /** Date d'expiration (TTL Mongo). */
  @Prop({ required: true })
  expiresAt!: Date;

  /** Nombre de tentatives de vérification (limite : 5). */
  @Prop({ default: 0 })
  attempts!: number;

  /** Mis à true après une vérification réussie pour empêcher la réutilisation. */
  @Prop({ default: false })
  consumed!: boolean;

  /**
   * Distingue les OTP d'inscription (création de compte en attente)
   * des OTP de login (compte déjà existant). Utile si on veut différencier.
   */
  @Prop({ enum: ['register', 'login'], default: 'login' })
  purpose!: 'register' | 'login';
}

export const OtpCodeSchema = SchemaFactory.createForClass(OtpCode);

// TTL : Mongo purge le doc dès qu'on dépasse expiresAt
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
