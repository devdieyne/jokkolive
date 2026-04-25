import { IsString, IsNotEmpty } from 'class-validator';

export class StartLiveDto {
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @IsString()
  @IsNotEmpty()
  tiktokUsername!: string;
}
