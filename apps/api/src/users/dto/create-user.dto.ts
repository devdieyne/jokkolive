import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SUPPORTED_CURRENCIES,
  type Currency,
  type UserRole,
} from '../../schemas/user.schema';

export class CreateUserDto {
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Le numéro doit être au format E.164 (ex: +221776583181)',
  })
  phone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Le pseudo ne doit contenir que des minuscules, chiffres et underscores',
  })
  pseudo!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsIn(['admin', 'seller'])
  role?: UserRole;

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES as readonly string[])
  currency?: Currency;
}
