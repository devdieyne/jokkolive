import { IsString, Length } from 'class-validator';

export class VerifyMagicLinkDto {
  /** Token hex 64 chars (32 bytes) généré par requestMagicLink. */
  @IsString()
  @Length(64, 64)
  token!: string;
}
