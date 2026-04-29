import { IsIn } from 'class-validator';
import { SUPPORTED_CURRENCIES, Currency } from '../../schemas/user.schema';

export class UpdateCurrencyDto {
  @IsIn(SUPPORTED_CURRENCIES as unknown as string[], {
    message: 'Devise non supportée',
  })
  currency!: Currency;
}
