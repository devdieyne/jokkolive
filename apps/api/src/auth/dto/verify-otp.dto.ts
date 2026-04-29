import { IsString, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'Numéro invalide (E.164)' })
  phone!: string;

  @IsString()
  @Length(6, 6, { message: 'Code OTP : 6 chiffres' })
  @Matches(/^[0-9]{6}$/, { message: 'Code OTP invalide' })
  code!: string;
}
