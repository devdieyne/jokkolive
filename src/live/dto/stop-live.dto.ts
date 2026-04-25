import { IsString, IsNotEmpty } from 'class-validator';

export class StopLiveDto {
  @IsString()
  @IsNotEmpty()
  sellerId!: string;
}
