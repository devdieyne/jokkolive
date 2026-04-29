import {
  Injectable,
  Logger,
  OnModuleInit,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, Currency } from '../schemas/user.schema';
import { OtpCode, OtpCodeDocument } from '../schemas/otp-code.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const OTP_TTL_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    phone: string;
    pseudo: string;
    displayName: string;
    role: 'admin' | 'seller';
    currency: Currency;
    payoutAccounts?: {
      wave?: { mobile: string };
      orangeMoney?: { mobile: string };
    };
    /**
     * Lien wa.me partageable que le vendeur peut diffuser. Quand un acheteur
     * clique, WhatsApp s'ouvre sur le numéro JokkoLive avec un message
     * pré-rempli `@<pseudo>:` — il n'a plus qu'à compléter par le code produit.
     */
    share?: {
      whatsappNumber: string;
      prefilledMessage: string;
      link: string;
    };
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(OtpCode.name)
    private readonly otpModel: Model<OtpCodeDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultAdmin();
  }

  // ── Inscription ────────────────────────────────────────────────────────────

  async register(
    phone: string,
    pseudo: string,
    displayName: string,
  ): Promise<{ phone: string; sent: boolean }> {
    const normalizedPseudo = pseudo.toLowerCase();

    const [phoneExists, pseudoExists] = await Promise.all([
      this.userModel.exists({ phone }),
      this.userModel.exists({ pseudo: normalizedPseudo }),
    ]);

    if (phoneExists) {
      throw new ConflictException('Ce numéro est déjà inscrit');
    }
    if (pseudoExists) {
      throw new ConflictException('Ce pseudo est déjà pris');
    }

    // Crée le compte avec rôle seller — il devra valider via OTP pour se connecter
    await this.userModel.create({
      phone,
      pseudo: normalizedPseudo,
      displayName: displayName.trim(),
      role: 'seller',
      currency: 'XOF',
    });

    await this.issueOtp(phone, 'register');
    return { phone, sent: true };
  }

  // ── Login (request + verify OTP) ──────────────────────────────────────────

  async requestOtp(phone: string): Promise<{ sent: boolean }> {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      throw new NotFoundException('Aucun compte associé à ce numéro');
    }
    if (user.disabled) {
      throw new ForbiddenException('Compte désactivé. Contactez l\'admin.');
    }

    await this.issueOtp(phone, 'login');
    return { sent: true };
  }

  async verifyOtp(phone: string, code: string): Promise<AuthResponse> {
    const otp = await this.otpModel
      .findOne({ phone, consumed: false })
      .sort({ createdAt: -1 })
      .exec();

    if (!otp) {
      throw new UnauthorizedException('Aucun code en attente. Demandez un nouveau code.');
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Code expiré. Demandez un nouveau code.');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Trop de tentatives. Demandez un nouveau code.');
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      otp.attempts += 1;
      await otp.save();
      throw new UnauthorizedException('Code incorrect');
    }

    otp.consumed = true;
    await otp.save();

    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      throw new NotFoundException('Compte introuvable');
    }
    if (user.disabled) {
      throw new ForbiddenException('Compte désactivé');
    }

    return this.buildAuthResponse(user);
  }

  // ── Profil ─────────────────────────────────────────────────────────────────

  async updateCurrency(userId: string, currency: Currency): Promise<AuthResponse> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { currency } }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.buildAuthResponse(user);
  }

  async getMe(userId: string): Promise<AuthResponse> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.buildAuthResponse(user);
  }

  // ── Internes ───────────────────────────────────────────────────────────────

  /**
   * Génère un OTP, le stocke en hash, et l'envoie via WhatsApp.
   * Rate-limit : un nouveau OTP ne peut être demandé qu'après 60 s.
   */
  private async issueOtp(
    phone: string,
    purpose: 'register' | 'login',
  ): Promise<void> {
    const lastOtp = await this.otpModel
      .findOne({ phone })
      .sort({ createdAt: -1 })
      .exec();

    if (lastOtp) {
      const ageSec = (Date.now() - lastOtp.get('createdAt').getTime()) / 1000;
      if (ageSec < OTP_RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - ageSec);
        throw new BadRequestException(
          `Patientez ${wait}s avant de redemander un code.`,
        );
      }
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 8);

    await this.otpModel.create({
      phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      purpose,
    });

    // sendOtp() délègue au provider :
    //  - Cloud → template AUTHENTICATION (obligatoire hors fenêtre 24h)
    //  - WAHA  → texte simple (pas de templates)
    // Le `purpose` n'affecte plus le contenu (template Meta = texte figé) ;
    // un message d'accueil "Bienvenue" doit être envoyé séparément après la
    // 1re commande/login si on veut le garder.
    await this.whatsapp.sendOtp(phone, code);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private buildAuthResponse(user: UserDocument): AuthResponse {
    const payload = {
      sub: user._id.toString(),
      phone: user.phone,
      pseudo: user.pseudo,
      role: user.role,
      displayName: user.displayName,
    };

    // Lien wa.me — basé sur le numéro WhatsApp public de la plateforme
    // (celui pairé dans WAHA). On expose `share` seulement si le numéro est
    // configuré, pour éviter de générer un lien cassé.
    const businessNumberRaw =
      this.configService.get<string>('WHATSAPP_BUSINESS_NUMBER') ?? '';
    const businessDigits = businessNumberRaw.replace(/[^0-9]/g, '');
    let share: AuthResponse['user']['share'];
    if (businessDigits) {
      const prefilled = `@${user.pseudo}: `;
      share = {
        whatsappNumber: `+${businessDigits}`,
        prefilledMessage: prefilled,
        link: `https://wa.me/${businessDigits}?text=${encodeURIComponent(prefilled)}`,
      };
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        phone: user.phone,
        pseudo: user.pseudo,
        displayName: user.displayName,
        role: user.role,
        currency: user.currency,
        payoutAccounts: user.payoutAccounts,
        share,
      },
    };
  }

  private async seedDefaultAdmin(): Promise<void> {
    const adminPhone =
      this.configService.get<string>('ADMIN_PHONE') ?? '+221776583181';
    const adminPseudo =
      this.configService.get<string>('ADMIN_PSEUDO') ?? 'admin';

    const exists = await this.userModel.findOne({ phone: adminPhone }).exec();
    if (exists) {
      // S'il existe déjà mais pas en admin, on promeut
      if (exists.role !== 'admin') {
        exists.role = 'admin';
        await exists.save();
        this.logger.log(`👑 ${adminPhone} promu admin`);
      }
      return;
    }

    // Évite la collision de pseudo si quelqu'un l'a pris
    let pseudo = adminPseudo;
    while (await this.userModel.exists({ pseudo })) {
      pseudo = `${adminPseudo}_${Math.floor(Math.random() * 1000)}`;
    }

    await this.userModel.create({
      phone: adminPhone,
      pseudo,
      displayName: 'Admin',
      role: 'admin',
      currency: 'XOF',
    });
    this.logger.log(`✅ Admin créé : ${adminPhone} (@${pseudo})`);
  }
}
