import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findMyProducts(@Request() req: AuthRequest) {
    return this.productsService.findAllForSeller(req.user.id);
  }

  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.user.id, dto);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.productsService.findOneOwned(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.productsService.remove(id, req.user.id);
  }
}
