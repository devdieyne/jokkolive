import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    return this.productModel.create({
      ...dto,
      keywords: dto.keywords ?? [],
      variants: dto.variants ?? [],
      stock: dto.stock ?? 0,
    });
  }

  async findAll(sellerId: string): Promise<ProductDocument[]> {
    return this.productModel.find({ sellerId }).exec();
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const product = await this.productModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async remove(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Product ${id} not found`);
  }
}
