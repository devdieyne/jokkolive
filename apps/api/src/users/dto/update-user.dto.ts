import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SUPPORTED_CURRENCIES,
  type Currency,
  type UserRole,
} from '../../schemas/user.schema';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsIn(['admin', 'seller'])
  role?: UserRole;

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES as readonly string[])
  currency?: Currency;

  @IsOptional()
  @IsBoolean()
  disabled?: boolean;
}
