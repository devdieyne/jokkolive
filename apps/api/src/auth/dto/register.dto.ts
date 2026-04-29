import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  /** Numéro WhatsApp E.164 — l'utilisateur compose indicatif + numéro côté UI. */
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Numéro invalide (format E.164 attendu, ex: +221776583181)',
  })
  phone!: string;

  /** Pseudo unique : 3-20 caractères, [a-z0-9_]. */
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9_]+$/i, {
    message:
      'Le pseudo ne peut contenir que des lettres, chiffres et underscores',
  })
  pseudo!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName!: string;
}
