import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsObject,
  Matches,
} from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @Matches(/^(70|75|76|77|78)\d{7}$/, {
    message: 'Numéro sénégalais invalide (ex: 771234567)',
  })
  buyerPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsObject()
  variant?: Record<string, string>;
}
