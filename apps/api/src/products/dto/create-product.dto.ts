import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  /** Préfixe : 1-4 lettres (R, C, PAN…). Insensible à la casse côté API. */
  @IsString()
  @Matches(/^[A-Za-z]{1,4}$/, {
    message: 'Le préfixe doit contenir 1 à 4 lettres',
  })
  prefix!: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
}
