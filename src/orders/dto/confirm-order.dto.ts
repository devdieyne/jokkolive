import { IsOptional, IsString, Matches } from 'class-validator';

export class ConfirmOrderDto {
  @IsOptional()
  @IsString()
  @Matches(/^(70|75|76|77|78)\d{7}$/, {
    message: 'Numéro sénégalais invalide (ex: 771234567)',
  })
  buyerPhone?: string;
}
