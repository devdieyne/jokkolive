import { IsIn, IsInt, IsPositive } from 'class-validator';

export class RequestPayoutDto {
  @IsInt()
  @IsPositive()
  amount!: number;

  @IsIn(['WAVE', 'ORANGE_MONEY'])
  provider!: 'WAVE' | 'ORANGE_MONEY';
}
