import { IsIn, IsNotEmpty } from 'class-validator';

export class InitiateCheckoutDto {
  @IsNotEmpty()
  @IsIn(['WAVE', 'ORANGE_MONEY'])
  provider!: 'WAVE' | 'ORANGE_MONEY';
}
