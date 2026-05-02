import { IsBoolean } from 'class-validator';

export class UpdateAutoPayoutDto {
  @IsBoolean()
  enabled!: boolean;
}
