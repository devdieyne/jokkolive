import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';

export class SetCurrentProductDto {
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @IsMongoId()
  productId!: string;
}
