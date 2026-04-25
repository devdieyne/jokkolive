import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  Min,
  IsArray,
  IsOptional,
  IsUrl,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  options!: string[];
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsNumber()
  @IsInt()
  @Min(1)
  priceFCFA!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
