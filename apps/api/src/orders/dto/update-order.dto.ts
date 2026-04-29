import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsIn(['pending', 'paid', 'cancelled', 'expired'])
  status?: 'pending' | 'paid' | 'cancelled' | 'expired';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  buyerName?: string;
}
