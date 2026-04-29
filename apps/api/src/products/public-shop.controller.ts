import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';

/**
 * Catalogue public — accessible sans authentification.
 * URL d'usage : `https://jokkolive.com/shop/<pseudo>` côté frontend.
 */
@Controller('public/shops')
export class PublicShopController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':pseudo')
  async getShop(@Param('pseudo') pseudo: string) {
    const data = await this.productsService.findPublicShop(pseudo);
    if (!data) throw new NotFoundException('Boutique introuvable');

    // Numéro WhatsApp public de la plateforme (utilisé par le frontend pour
    // construire les liens wa.me préfilés sans avoir besoin d'une seconde
    // requête).
    const businessNumberRaw =
      this.configService.get<string>('WHATSAPP_BUSINESS_NUMBER') ?? '';
    const whatsappNumber = businessNumberRaw.replace(/[^0-9]/g, '');

    return {
      ...data,
      whatsappNumber: whatsappNumber ? `+${whatsappNumber}` : null,
    };
  }
}
