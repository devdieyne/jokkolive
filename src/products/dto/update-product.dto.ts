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

export class UpdateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  options!: string[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(1)
  priceFCFA?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductVariantDto)
  variants?: UpdateProductVariantDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
