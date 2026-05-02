import { IsInt, IsNumber, Max, Min } from 'class-validator';

/**
 * Override admin des frais plateforme pour un vendeur.
 *
 * Les deux champs sont obligatoires : on définit toujours un couple complet
 * `(flat, percent)` plutôt que de mélanger override partiel + fallback env.
 * Pour revenir aux frais par défaut → `DELETE /users/:id/platform-fee`.
 */
export class UpdatePlatformFeeDto {
  /** Frais fixes en FCFA (entier ≥ 0, max 100 000 par sécurité). */
  @IsInt()
  @Min(0)
  @Max(100_000)
  flat!: number;

  /** Pourcentage en décimal : 0 (0%) → 1 (100%). Ex: 0.03 pour 3%. */
  @IsNumber()
  @Min(0)
  @Max(1)
  percent!: number;
}
