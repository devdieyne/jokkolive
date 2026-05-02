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
import { UpdatePlatformFeeDto } from './dto/update-platform-fee.dto';

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

  /**
   * Override admin des frais plateforme pour un vendeur. Les deux champs
   * (flat, percent) sont systématiquement écrits ensemble pour éviter
   * un état mixte override-partiel/fallback-env confusing.
   */
  async setPlatformFee(
    id: string,
    dto: UpdatePlatformFeeDto,
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { platformFee: { flat: dto.flat, percent: dto.percent } } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Utilisateur introuvable');
    return updated;
  }

  /**
   * Reset l'override : ce vendeur retombe sur les valeurs env globales
   * (`PLATFORM_FEE_FLAT` / `PLATFORM_FEE_PERCENT`).
   */
  async clearPlatformFee(id: string): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $unset: { platformFee: 1 } }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Utilisateur introuvable');
    return updated;
  }
}
