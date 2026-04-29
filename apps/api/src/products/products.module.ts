import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../schemas/product.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PublicShopController } from './public-shop.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ProductsService],
  controllers: [ProductsController, PublicShopController],
  exports: [ProductsService],
})
export class ProductsModule {}
