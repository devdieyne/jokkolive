import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product> & {
  createdAt: Date;
  updatedAt: Date;
};

export interface ProductVariant {
  name: string;
  options: string[];
}

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  sellerId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ required: true })
  priceFCFA!: number;

  @Prop({
    type: [{ name: String, options: [String] }],
    default: [],
  })
  variants!: ProductVariant[];

  @Prop({ default: 0 })
  stock!: number;

  @Prop()
  imageUrl?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
