import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const phone = dto.phone.trim();
    const pseudo = dto.pseudo.toLowerCase().trim();

    const existing = await this.userModel
      .findOne({ $or: [{ phone }, { pseudo }] })
      .exec();
    if (existing) {
      if (existing.phone === phone) {
        throw new ConflictException('Numéro de téléphone déjà utilisé');
      }
      throw new ConflictException('Pseudo déjà utilisé');
    }

    return this.userModel.create({
      phone,
      pseudo,
      displayName: dto.displayName.trim(),
      role: dto.role ?? 'seller',
      currency: dto.currency ?? 'XOF',
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Utilisateur introuvable');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const res = await this.userModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Utilisateur introuvable');
  }
}
