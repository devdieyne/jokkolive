import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

class PayoutAccountDto {
  @IsString()
  @Matches(/^[0-9]{9}$/, {
    message: 'Le numéro doit contenir exactement 9 chiffres',
  })
  mobile!: string;
}

export class UpdatePayoutAccountsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PayoutAccountDto)
  wave?: PayoutAccountDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayoutAccountDto)
  orangeMoney?: PayoutAccountDto;
}
