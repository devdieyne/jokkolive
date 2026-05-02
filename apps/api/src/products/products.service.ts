import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const MAX_CREATE_ATTEMPTS = 5;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findAllForSeller(sellerId: string): Promise<ProductDocument[]> {
    return this.productModel
      .find({ sellerId: new Types.ObjectId(sellerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOneOwned(productId: string, sellerId: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) throw new NotFoundException('Produit introuvable');
    if (product.sellerId.toString() !== sellerId) {
      throw new ForbiddenException('Ce produit ne vous appartient pas');
    }
    return product;
  }

  /**
   * Catalogue public d'un vendeur — utilisé par la page `/shop/:pseudo`.
   * Renvoie le vendeur + ses produits actifs uniquement, sans détails sensibles.
   */
  async findPublicShop(
    pseudo: string,
  ): Promise<{
    seller: { pseudo: string; displayName: string; currency: string };
    products: ProductDocument[];
  } | null> {
    const seller = await this.userModel
      .findOne({ pseudo: pseudo.toLowerCase(), disabled: false })
      .exec();
    if (!seller) return null;

    const products = await this.productModel
      .find({ sellerId: seller._id, disabled: false })
      .sort({ createdAt: -1 })
      .exec();

    return {
      seller: {
        pseudo: seller.pseudo,
        displayName: seller.displayName,
        currency: seller.currency,
      },
      products,
    };
  }

  async findByPseudoAndCode(
    pseudo: string,
    code: string,
  ): Promise<{ product: ProductDocument; seller: UserDocument } | null> {
    const seller = await this.userModel
      .findOne({ pseudo: pseudo.toLowerCase() })
      .exec();
    if (!seller) return null;

    const product = await this.productModel
      .findOne({
        sellerId: seller._id,
        code: code.toUpperCase(),
        disabled: false,
      })
      .exec();
    if (!product) return null;

    return { product, seller };
  }

  /**
   * Crée un produit avec code auto-incrémenté.
   *
   * Race-safe : on lit la séquence max, on tente l'insert ; si l'index unique
   * (sellerId, prefix, seq) saute (deux créations concurrentes), on
   * incrémente et on réessaie. Quelques tentatives suffisent largement.
   */
  async create(sellerId: string, dto: CreateProductDto): Promise<ProductDocument> {
    const seller = await this.userModel.findById(sellerId).exec();
    if (!seller) throw new NotFoundException('Vendeur introuvable');

    const prefix = dto.prefix.toUpperCase();

    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
      const last = await this.productModel
        .findOne({ sellerId: seller._id, prefix })
        .sort({ seq: -1 })
        .select('seq')
        .lean()
        .exec();
      const seq = (last?.seq ?? 0) + 1 + attempt;
      const code = `${prefix}${seq}`;

      try {
        return await this.productModel.create({
          sellerId: seller._id,
          name: dto.name.trim(),
          prefix,
          seq,
          code,
          price: dto.price,
          currency: seller.currency,
          stock: dto.stock ?? 0,
          description: dto.description,
          imageUrl: dto.imageUrl,
        });
      } catch (err: unknown) {
        const code11000 = (err as { code?: number })?.code === 11000;
        if (code11000) {
          this.logger.warn(
            `Collision séquence ${prefix}${seq} pour seller ${sellerId}, retry...`,
          );
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException(
      'Impossible d\'attribuer un code produit (réessayez)',
    );
  }

  async update(
    productId: string,
    sellerId: string,
    dto: UpdateProductDto,
  ): Promise<ProductDocument> {
    const product = await this.findOneOwned(productId, sellerId);

    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl;
    if (dto.disabled !== undefined) product.disabled = dto.disabled;

    return product.save();
  }

  async remove(productId: string, sellerId: string): Promise<void> {
    const product = await this.findOneOwned(productId, sellerId);
    await product.deleteOne();
  }

  /**
   * Tente de décrémenter atomiquement le stock du produit. Race-safe :
   * `findOneAndUpdate` est atomique dans Mongo. Si le stock est déjà à 0
   * (ou si le produit n'existe pas), retourne false et ne touche rien.
   *
   * Utilisé à la création d'une commande pour éviter qu'en live TikTok
   * 10 acheteurs commandent en même temps un stock de 5.
   */
  async tryDecrementStock(
    productId: Types.ObjectId | string,
    quantity = 1,
  ): Promise<boolean> {
    const id =
      typeof productId === 'string'
        ? new Types.ObjectId(productId)
        : productId;
    const updated = await this.productModel
      .findOneAndUpdate(
        { _id: id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true },
      )
      .exec();
    return !!updated;
  }

  /**
   * Restaure du stock (ex: commande annulée/expirée avant paiement).
   * Toujours sûr — pas de race possible sur un $inc positif.
   */
  async restoreStock(
    productId: Types.ObjectId | string,
    quantity = 1,
  ): Promise<void> {
    const id =
      typeof productId === 'string'
        ? new Types.ObjectId(productId)
        : productId;
    await this.productModel
      .updateOne({ _id: id }, { $inc: { stock: quantity } })
      .exec();
  }
}
