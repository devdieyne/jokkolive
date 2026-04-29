import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'Numéro invalide (E.164)' })
  phone!: string;
}
